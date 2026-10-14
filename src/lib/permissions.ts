import type { User } from './types'

/** Every staff function that can be granted to a role (same keys as the Sammha API, Domain/Permissions.cs). */
export const PERMISSIONS = [
  { key: 'overview.view', group: 'عام', label: 'النظرة العامة', description: 'لوحة الأرقام والمؤشرات' },
  { key: 'requests.view', group: 'طلبات الملاك', label: 'عرض الطلبات', description: 'قائمة طلبات الشعارات والأسماء المركبة والاستثمار وتفاصيلها' },
  { key: 'requests.review', group: 'طلبات الملاك', label: 'مراجعة طلبات الشعارات', description: 'قبول الأسماء أو رفضها، ورفض الطلب كاملًا' },
  { key: 'requests.cancel', group: 'طلبات الملاك', label: 'إلغاء الطلبات', description: 'إلغاء طلب مع رد الضمان للمالك' },
  { key: 'requests.audit', group: 'طلبات الملاك', label: 'تقرير تدقيق الشعارات', description: 'المطابق والمشابه (بـ«ال» أو بدونها، جمع أو مفرد) وأعلى سعر لشعار مشابه، مع الطباعة' },
  { key: 'auctions.schedule', group: 'المزادات', label: 'فتح المزادات', description: 'جدولة الأسماء المقبولة في مزادات' },
  { key: 'auctions.manage', group: 'المزادات', label: 'التحكم في المزادات', description: 'إيقاف مؤقت واستئناف وتمديد، لمزاد محدد أو لكل المزادات' },
  { key: 'auctions.cancel', group: 'المزادات', label: 'إلغاء المزادات', description: 'إلغاء مزاد دون بيع وإعادة الاسم لقائمة الجدولة أو لمالكه' },
  { key: 'invoices.view', group: 'المالية', label: 'عرض الفواتير', description: 'كل فواتير المنصة' },
  { key: 'invoices.mark_paid', group: 'المالية', label: 'تأكيد السداد', description: 'تعليم فاتورة مدفوعة يدويًا (تحويل بنكي مثلًا)' },
  { key: 'wallets.view', group: 'المالية', label: 'تقرير المحافظ', description: 'أرصدة محافظ الملاك وحركاتها وطلبات الاسترداد' },
  { key: 'wallets.refund', group: 'المالية', label: 'الاسترداد للحساب البنكي', description: 'تنفيذ طلبات الاسترداد أو رفضها، واسترداد مباشر برقم التحويل' },
  { key: 'banks.verify', group: 'المالية', label: 'اعتماد الحسابات البنكية', description: 'مراجعة شهادة الآيبان التي رفعها المالك واعتماد حسابه أو رفضه' },
  { key: 'wallets.adjust', group: 'المالية', label: 'تسوية رصيد المحفظة', description: 'إضافة مبلغ أو خصمه من محفظة مالك مع ذكر السبب' },
  { key: 'deposits.view', group: 'المالية', label: 'تقرير الضمانات', description: 'ضمانات طلبات الشعارات وضمانات دخول مزادات إعادة البيع' },
  { key: 'deposits.refund', group: 'المالية', label: 'استرداد الضمان', description: 'إعادة ضمان محجوز إلى محفظة صاحبه مع ذكر السبب' },
  { key: 'reports.marks', group: 'التقارير', label: 'تقرير الشعارات', description: 'كل المزادات برقمها: الطلب والمالك والفائز وقيمة الفوز والفاتورة، مع الطباعة والتصدير' },
  { key: 'tickets.view', group: 'الدعم', label: 'عرض الشكاوى والبلاغات', description: 'قائمة التذاكر وتفاصيلها' },
  { key: 'tickets.reply', group: 'الدعم', label: 'الرد على التذاكر', description: 'الرد على العميل وكتابة ملاحظات داخلية' },
  { key: 'tickets.manage', group: 'الدعم', label: 'إدارة التذاكر', description: 'تغيير الحالة والأولوية والإسناد' },
  { key: 'events.manage', group: 'المحتوى', label: 'المواعيد والفعاليات', description: 'إضافة فعاليات الإبل وتعديلها وحذفها' },
  { key: 'owners.view', group: 'العملاء', label: 'بيانات العملاء (CRM)', description: 'قائمة الملاك وشعاراتهم حسب الفئة؛ الهوية والجوال يظهران مخفيين جزئيًا' },
  { key: 'owners.full', group: 'العملاء', label: 'البيانات الكاملة والطباعة والتصدير', description: 'إظهار رقم الهوية والجوال كاملين، وطباعة التقرير وتصديره (يُسجَّل في سجل التغييرات)' },
  { key: 'users.view', group: 'المستخدمون', label: 'عرض المستخدمين', description: 'قائمة الملاك والموظفين' },
  { key: 'users.create', group: 'المستخدمون', label: 'إنشاء مستخدم', description: 'إضافة حسابات موظفين جديدة' },
  { key: 'users.roles', group: 'المستخدمون', label: 'تحديد دور الموظف', description: 'تغيير دور الموظف وصلاحياته' },
  { key: 'users.suspend', group: 'المستخدمون', label: 'إيقاف الحسابات وتفعيلها', description: 'إيقاف حساب مالك أو موظف وإعادة تفعيله' },
  { key: 'roles.manage', group: 'المستخدمون', label: 'الأدوار والصلاحيات', description: 'إنشاء الأدوار وتحديد صلاحيات كل دور' },
  { key: 'settings.manage', group: 'الإعدادات', label: 'إعدادات المنصة', description: 'استقبال الطلبات، الإعلان، الصيانة، بيانات التواصل' },
  { key: 'security.manage', group: 'الإعدادات', label: 'سياسة الأمان', description: 'كلمات المرور وقفل الدخول ومهلة الخمول وتسجيل خروج الجميع' },
  { key: 'audit.view', group: 'الإعدادات', label: 'سجل التغييرات', description: 'سجل تعديلات الإعدادات والإجراءات الإدارية' },
] as const

export type Permission = (typeof PERMISSIONS)[number]['key']
export const ALL_PERMISSIONS: Permission[] = PERMISSIONS.map((p) => p.key)

/** what the approval committee could do before roles existed (the built-in «لجنة الاعتماد» role) */
export const COMMITTEE_DEFAULT: Permission[] = ['overview.view', 'requests.view', 'requests.review', 'requests.cancel', 'auctions.schedule', 'invoices.view', 'tickets.view', 'tickets.reply', 'tickets.manage', 'events.manage', 'users.view']
export const COMMITTEE_ROLE_ID = '5a3f0000-0000-4000-8000-0000000000c1'

export const permissionLabel = (k: string) => PERMISSIONS.find((p) => p.key === k)?.label ?? k

/** admins can do everything; committee members what their role allows */
export function can(user: User | null | undefined, perm: Permission): boolean {
  if (!user || user.role === 'owner') return false
  if (user.role === 'admin') return true
  return (user.permissions ?? COMMITTEE_DEFAULT).includes(perm)
}
export const canAny = (user: User | null | undefined, perms: Permission[]) => perms.some((p) => can(user, p))
