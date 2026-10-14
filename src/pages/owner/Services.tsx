import { ServicesGrid } from '../../components/Services'
import { PageHead } from '../../components/ui'
import { tr } from '../../lib/i18n'

export function ServicesPage() {
  return (
    <>
      <PageHead title={tr('الخدمات الإلكترونية', 'E-services')} sub={tr('كل خدمات سمّها في مكان واحد: اختر الخدمة واطّلع على رسومها ثم تقدّم لها.', 'Every Sammha service in one place: pick a service, check its fee, then apply.')} />
      <ServicesGrid audience="owner" />
    </>
  )
}

/** the public page: the same cards; applying asks visitors to sign in first */
export function PublicServices() {
  return (
    <div className="wrap py-10">
      <PageHead title={tr('الخدمات الإلكترونية', 'E-services')} sub={tr('كل خدمات سمّها في مكان واحد. للتقدّم لأي خدمة سجّل الدخول بحساب مالك الإبل.', 'Every Sammha service in one place. Sign in with your camel owner account to apply.')} />
      <ServicesGrid audience="public" />
    </div>
  )
}
