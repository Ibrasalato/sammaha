// Creates a Moyasar hosted invoice for a card payment and returns its URL.
// purpose: 'topup' | 'deposit' (ref = request id) | 'invoice' (ref = invoice id)
// Env: MOYASAR_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const jwt = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const { data: { user } } = await admin.auth.getUser(jwt)
  if (!user) return json({ error: 'سجّل الدخول أولًا' }, 401)

  const { purpose, ref, amount: requested, callback } = await req.json()
  // Never trust the browser's amount: read it from the database
  let amount = Number(requested)
  if (purpose === 'deposit') {
    const { data } = await admin.from('requests').select('deposit_amount,user_id,status').eq('id', ref).single()
    if (!data || data.user_id !== user.id || data.status !== 'pending_payment') return json({ error: 'الطلب غير متاح للسداد' }, 400)
    amount = Number(data.deposit_amount)
  } else if (purpose === 'invoice') {
    const { data } = await admin.from('invoices').select('amount_due,user_id,status').eq('id', ref).single()
    if (!data || data.user_id !== user.id || data.status !== 'unpaid') return json({ error: 'الفاتورة غير متاحة للسداد' }, 400)
    amount = Number(data.amount_due)
  } else if (!(amount >= 10 && amount <= 100000)) {
    return json({ error: 'مبلغ غير صحيح' }, 400)
  }

  const { data: payment } = await admin.from('payments')
    .insert({ user_id: user.id, purpose, ref: ref || null, amount }).select().single()

  const res = await fetch('https://api.moyasar.com/v1/invoices', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(Deno.env.get('MOYASAR_SECRET_KEY')! + ':'), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: Math.round(amount * 100), // halalas
      currency: 'SAR',
      description: purpose === 'deposit' ? 'ضمان مزاد — منصة سمّها' : purpose === 'invoice' ? 'سداد فاتورة — منصة سمّها' : 'شحن محفظة — منصة سمّها',
      callback_url: callback,
      metadata: { payment_id: payment!.id },
    }),
  })
  const inv = await res.json()
  if (!res.ok) return json({ error: inv.message ?? 'تعذّر إنشاء عملية الدفع' }, 502)
  await admin.from('payments').update({ provider_id: inv.id }).eq('id', payment!.id)
  return json({ url: inv.url })
})

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
