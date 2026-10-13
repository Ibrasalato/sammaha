// Moyasar webhook (event: payment_paid). Credits the wallet, then completes the
// deposit or invoice the payment was for. Env: MOYASAR_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const body = await req.json()
  if (body.secret_token !== Deno.env.get('MOYASAR_WEBHOOK_SECRET')) return new Response('forbidden', { status: 403 })
  if (body.type !== 'payment_paid') return new Response('ignored')

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const paymentId = body.data?.metadata?.payment_id
  const { data: p } = await admin.from('payments').select('*').eq('id', paymentId).single()
  if (!p || p.status === 'paid') return new Response('ok')
  if (Math.round(Number(p.amount) * 100) !== body.data.amount) return new Response('amount mismatch', { status: 400 })

  await admin.from('payments').update({ status: 'paid' }).eq('id', p.id)
  await admin.from('wallet_txs').insert({ user_id: p.user_id, amount: p.amount, kind: 'topup', note: 'دفع بالبطاقة عبر ميسّر', ref: p.id })
  if (p.purpose === 'deposit') await admin.rpc('pay_deposit_for', { p_user: p.user_id, p_request: p.ref })
  if (p.purpose === 'invoice') await admin.rpc('pay_invoice_for', { p_user: p.user_id, p_invoice: p.ref })
  if (p.purpose === 'bid_deposit') await admin.rpc('pay_bid_deposit_for', { p_user: p.user_id, p_auction: p.ref })
  if (p.purpose === 'listing') await admin.rpc('buy_listing_for', { p_user: p.user_id, p_listing: p.ref })
  return new Response('ok')
})
