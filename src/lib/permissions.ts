import { tr } from './i18n'
import type { User } from './types'

/** Every staff function that can be granted to a role (same keys as the Sammha API, Domain/Permissions.cs). */
export const PERMISSIONS = [
  { key: 'overview.view', group: 'عام', get label() { return tr('النظرة العامة', 'Overview') }, get description() { return tr('لوحة الأرقام والمؤشرات', 'Key figures and indicators dashboard') } },
  { key: 'requests.view', group: 'طلبات الملاك', get label() { return tr('عرض الطلبات', 'View requests') }, get description() { return tr('قائمة طلبات الشعارات والأسماء المركبة والاستثمار وتفاصيلها', 'List and details of mark, compound name and investment requests') } },
  { key: 'requests.review', group: 'طلبات الملاك', get label() { return tr('مراجعة طلبات الشعارات', 'Review mark requests') }, get description() { return tr('قبول الأسماء أو رفضها، ورفض الطلب كاملًا', 'Accept or reject names, or reject the whole request') } },
  { key: 'requests.cancel', group: 'طلبات الملاك', get label() { return tr('إلغاء الطلبات', 'Cancel requests') }, get description() { return tr('إلغاء طلب مع رد الضمان للمالك', 'Cancel a request and refund the guarantee to the owner') } },
  { key: 'requests.audit', group: 'طلبات الملاك', get label() { return tr('تقرير تدقيق الشعارات', 'Mark audit report') }, get description() { return tr('المطابق والمشابه (بـ«ال» أو بدونها، جمع أو مفرد) وأعلى سعر لشعار مشابه، مع الطباعة', 'Exact and similar matches (with or without "Al", plural or singular) and the highest price of a similar mark, with printing') } },
  { key: 'auctions.schedule', group: 'المزادات', get label() { return tr('فتح المزادات', 'Open auctions') }, get description() { return tr('جدولة الأسماء المقبولة في مزادات', 'Schedule accepted names into auctions') } },
  { key: 'auctions.manage', group: 'المزادات', get label() { return tr('التحكم في المزادات', 'Control auctions') }, get description() { return tr('إيقاف مؤقت واستئناف وتمديد، لمزاد محدد أو لكل المزادات', 'Pause, resume and extend one auction or all auctions') } },
  { key: 'auctions.cancel', group: 'المزادات', get label() { return tr('إلغاء المزادات', 'Cancel auctions') }, get description() { return tr('إلغاء مزاد دون بيع وإعادة الاسم لقائمة الجدولة أو لمالكه', 'Cancel an auction without a sale and return the name to the schedule list or its owner') } },
  { key: 'invoices.view', group: 'المالية', get label() { return tr('عرض الفواتير', 'View invoices') }, get description() { return tr('كل فواتير المنصة', 'All platform invoices') } },
  { key: 'invoices.mark_paid', group: 'المالية', get label() { return tr('تأكيد السداد', 'Confirm payment') }, get description() { return tr('تعليم فاتورة مدفوعة يدويًا (تحويل بنكي مثلًا)', 'Mark an invoice as paid manually (e.g. bank transfer)') } },
  { key: 'wallets.view', group: 'المالية', get label() { return tr('تقرير المحافظ', 'Wallets report') }, get description() { return tr('أرصدة محافظ الملاك وحركاتها وطلبات الاسترداد', 'Owner wallet balances, transactions and refund requests') } },
  { key: 'wallets.refund', group: 'المالية', get label() { return tr('الاسترداد للحساب البنكي', 'Refund to bank account') }, get description() { return tr('تنفيذ طلبات الاسترداد أو رفضها، واسترداد مباشر برقم التحويل', 'Process or reject refund requests, and refund directly with a transfer reference') } },
  { key: 'banks.verify', group: 'المالية', get label() { return tr('اعتماد الحسابات البنكية', 'Verify bank accounts') }, get description() { return tr('مراجعة شهادة الآيبان التي رفعها المالك واعتماد حسابه أو رفضه', 'Review the IBAN certificate uploaded by the owner and approve or reject the account') } },
  { key: 'wallets.adjust', group: 'المالية', get label() { return tr('تسوية رصيد المحفظة', 'Adjust wallet balance') }, get description() { return tr('إضافة مبلغ أو خصمه من محفظة مالك مع ذكر السبب', 'Credit or debit an owner\'s wallet with a stated reason') } },
  { key: 'deposits.view', group: 'المالية', get label() { return tr('تقرير الضمانات', 'Guarantees report') }, get description() { return tr('ضمانات طلبات الشعارات وضمانات دخول مزادات إعادة البيع', 'Mark request guarantees and resale auction entry guarantees') } },
  { key: 'deposits.refund', group: 'المالية', get label() { return tr('استرداد الضمان', 'Refund guarantee') }, get description() { return tr('إعادة ضمان محجوز إلى محفظة صاحبه مع ذكر السبب', 'Return a held guarantee to its owner\'s wallet with a stated reason') } },
  { key: 'names.ico', group: 'سجل الأسماء', get label() { return tr('أسماء المنظمة الدولية', 'Organization names') }, get description() { return tr('الأسماء التي آلت إلى المنظمة لعدم سداد الفائز في المهلة، وطرحها في مزاد جديد', 'Names that passed to the organization because the winner did not pay in time, and auctioning them again') } },
  { key: 'certificates.manage', group: 'سجل الأسماء', get label() { return tr('الشهادات الصادرة', 'Issued certificates') }, get description() { return tr('كل الشهادات التي أصدرها الملاك، والتحقق منها، وإلغاء شهادة مع ذكر السبب', 'Every certificate owners issued, verifying them, and revoking one with a reason') } },
  { key: 'names.latin', group: 'سجل الأسماء', get label() { return tr('الكتابة اللاتينية للأسماء', 'Latin spelling of names') }, get description() { return tr('تصحيح كتابة الأسماء بالحروف اللاتينية كما تظهر في الموقع الإنجليزي والشهادات', 'Correct how names are spelled in Latin letters on the English site and certificates') } },
  { key: 'reports.marks', group: 'التقارير', get label() { return tr('تقرير الشعارات', 'Marks report') }, get description() { return tr('كل المزادات برقمها: الطلب والمالك والفائز وقيمة الفوز والفاتورة، مع الطباعة والتصدير', 'Every auction by number: request, owner, winner, winning amount and invoice, with printing and export') } },
  { key: 'tickets.view', group: 'الدعم', get label() { return tr('عرض الشكاوى والبلاغات', 'View complaints & reports') }, get description() { return tr('قائمة التذاكر وتفاصيلها', 'Ticket list and details') } },
  { key: 'tickets.reply', group: 'الدعم', get label() { return tr('الرد على التذاكر', 'Reply to tickets') }, get description() { return tr('الرد على العميل وكتابة ملاحظات داخلية', 'Reply to the customer and write internal notes') } },
  { key: 'tickets.manage', group: 'الدعم', get label() { return tr('إدارة التذاكر', 'Manage tickets') }, get description() { return tr('تغيير الحالة والأولوية والإسناد', 'Change status, priority and assignment') } },
  { key: 'events.manage', group: 'المحتوى', get label() { return tr('المواعيد والفعاليات', 'Dates & events') }, get description() { return tr('إضافة فعاليات الإبل وتعديلها وحذفها', 'Add, edit and delete camel events') } },
  { key: 'owners.view', group: 'العملاء', get label() { return tr('بيانات العملاء (CRM)', 'Customer data (CRM)') }, get description() { return tr('قائمة الملاك وشعاراتهم حسب الفئة؛ الهوية والجوال يظهران مخفيين جزئيًا', 'Owners and their marks by category; ID and mobile are partially masked') } },
  { key: 'owners.full', group: 'العملاء', get label() { return tr('البيانات الكاملة والطباعة والتصدير', 'Full data, printing & export') }, get description() { return tr('إظهار رقم الهوية والجوال كاملين، وطباعة التقرير وتصديره (يُسجَّل في سجل التغييرات)', 'Show full ID and mobile numbers, and print and export the report (recorded in the change history)') } },
  { key: 'users.view', group: 'المستخدمون', get label() { return tr('عرض المستخدمين', 'View users') }, get description() { return tr('قائمة الملاك والموظفين', 'List of owners and staff') } },
  { key: 'users.create', group: 'المستخدمون', get label() { return tr('إنشاء مستخدم', 'Create user') }, get description() { return tr('إضافة حسابات موظفين جديدة', 'Add new staff accounts') } },
  { key: 'users.roles', group: 'المستخدمون', get label() { return tr('تحديد دور الموظف', 'Assign staff role') }, get description() { return tr('تغيير دور الموظف وصلاحياته', 'Change a staff member\'s role and permissions') } },
  { key: 'users.suspend', group: 'المستخدمون', get label() { return tr('إيقاف الحسابات وتفعيلها', 'Suspend & reactivate accounts') }, get description() { return tr('إيقاف حساب مالك أو موظف وإعادة تفعيله', 'Suspend an owner or staff account and reactivate it') } },
  { key: 'roles.manage', group: 'المستخدمون', get label() { return tr('الأدوار والصلاحيات', 'Roles & permissions') }, get description() { return tr('إنشاء الأدوار وتحديد صلاحيات كل دور', 'Create roles and set the permissions of each role') } },
  { key: 'settings.manage', group: 'الإعدادات', get label() { return tr('إعدادات المنصة', 'Platform settings') }, get description() { return tr('استقبال الطلبات، الإعلان، الصيانة، بيانات التواصل', 'Accepting requests, announcement, maintenance, contact details') } },
  { key: 'security.manage', group: 'الإعدادات', get label() { return tr('سياسة الأمان', 'Security policy') }, get description() { return tr('كلمات المرور وقفل الدخول ومهلة الخمول وتسجيل خروج الجميع', 'Passwords, sign-in lockout, idle timeout and signing everyone out') } },
  { key: 'logs.view', group: 'الإعدادات', get label() { return tr('سجل النشاط (Logs)', 'Activity log') }, get description() { return tr('كل ما يجري على المنصة بالتاريخ والوقت: الدخول والطلبات والمزايدات والمدفوعات وإجراءات الموظفين والمفوضين', 'Everything on the platform with date and time: sign-ins, requests, bids, payments and actions by staff and delegates') } },
  { key: 'audit.view', group: 'الإعدادات', get label() { return tr('سجل التغييرات', 'Change history') }, get description() { return tr('سجل تعديلات الإعدادات والإجراءات الإدارية', 'Record of settings changes and administrative actions') } },
] as const

const GROUP_EN: Record<string, string> = {
  'عام': 'General',
  'طلبات الملاك': 'Owner requests',
  'المزادات': 'Auctions',
  'المالية': 'Finance',
  'التقارير': 'Reports',
  'سجل الأسماء': 'Names registry',
  'الدعم': 'Support',
  'المحتوى': 'Content',
  'العملاء': 'Customers',
  'المستخدمون': 'Users',
  'الإعدادات': 'Settings',
}
/** `group` stays the Arabic key (stable for grouping); this gives its label in the current language */
export const permissionGroupLabel = (g: string) => tr(g, GROUP_EN[g] ?? g)

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
