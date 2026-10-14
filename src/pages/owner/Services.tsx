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
