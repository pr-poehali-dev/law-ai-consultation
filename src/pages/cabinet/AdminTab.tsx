import AdminLawyerBlock from "@/pages/cabinet/AdminLawyerBlock";
import AdminBillingBlock from "@/pages/cabinet/AdminBillingBlock";
import AdminUsersBlock from "@/pages/cabinet/AdminUsersBlock";
import AdminSearchBlock from "@/pages/cabinet/AdminSearchBlock";

export default function AdminTab() {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h2 className="font-cormorant font-bold text-2xl sm:text-3xl text-navy-800 mb-4 sm:mb-6">Администратор</h2>
      <AdminSearchBlock />
      <AdminLawyerBlock />
      <AdminBillingBlock />
      <AdminUsersBlock />
    </div>
  );
}