// Super admin creates a staff account (approval committee or another admin) with a temporary password.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const jwt = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const { data: { user } } = await admin.auth.getUser(jwt)
  if (!user) return json({ error: 'سجّل الدخول أولًا' }, 401)
  const { data: me } = await admin.from('profiles').select('role,active').eq('id', user.id).single()
  if (!me || me.role !== 'admin' || me.active === false) return json({ error: 'هذه العملية لمدير النظام فقط' }, 403)

  const { fullName, phone, email, password, role } = await req.json()
  const p = String(phone ?? '').replace(/\s/g, '')
  if (String(fullName ?? '').trim().length < 3) return json({ error: 'اكتب اسم الموظف' }, 400)
  if (!/^05\d{8}$/.test(p)) return json({ error: 'رقم الجوال يبدأ بـ 05 ويتكون من 10 أرقام' }, 400)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? ''))) return json({ error: 'البريد الإلكتروني غير صحيح' }, 400)
  if (String(password ?? '').length < 8) return json({ error: 'كلمة المرور المؤقتة 8 أحرف على الأقل' }, 400)
  if (role !== 'committee' && role !== 'admin') return json({ error: 'اختر الصلاحية' }, 400)
  const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('phone', p)
  if (count) return json({ error: 'رقم الجوال مسجل لحساب آخر' }, 400)

  const { data: created, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: String(fullName).trim(), phone: p },
  })
  if (error || !created.user) return json({ error: error?.message.includes('already') ? 'البريد الإلكتروني مسجل لحساب آخر' : error?.message }, 400)
  // the profile row is made by the on_auth_user_created trigger; give it the staff role
  const { data: prof, error: e2 } = await admin.from('profiles').update({ role }).eq('id', created.user.id)
    .select('id, full_name, phone, email, role, active, created_at').single()
  if (e2) return json({ error: e2.message }, 400)
  return json({ id: prof.id, fullName: prof.full_name, phone: prof.phone, email: prof.email, role: prof.role, active: prof.active, createdAt: prof.created_at })
})
