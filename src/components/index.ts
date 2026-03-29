export { Layout } from './Layout';
export type { Page } from './Layout';
export { LeadPage } from './LeadPage';
export { DealPage } from './DealPage';
export { DealCard } from './DealCard';
export { DealForm } from './DealForm';
export { DealDetail } from './DealDetail';
export { KanbanCol } from './KanbanCol';
export { ShipBadge, IncoBadge, PayBadge } from './Badges';
export { Dashboard } from './Dashboard';
export { AccountPage } from './AccountPage';
export { AccountForm } from './AccountForm';
export { AccountDetail } from './AccountDetail';
export { ContactPage } from './ContactPage';
export { ContactForm } from './ContactForm';
export { ContactDetail } from './ContactDetail';

// Shared
export { ErrorBoundary } from './shared/ErrorBoundary';
export { ToastProvider, useToast } from './shared/ToastProvider';
export { LoginScreen } from './shared/LoginScreen';

// Deals (Phase 2)
export { InvoiceUploadModal, getInvoiceFiles } from './deals/InvoiceUploadModal';
export { ActivityTimeline } from './deals/ActivityTimeline';

// Leads (Phase 2)
export { LeadDetail } from './leads/LeadDetail';

// Settings (Phase 2)
export { SettingsManager } from './settings/SettingsManager';
export { BusinessManager } from './settings/BusinessManager';
export { CategoryModal } from './shared/CategoryModal';
export { CSVImporter } from './shared/CSVImporter';

// Phase 3: New Pages
export { WeeklyReportPage } from './reports/WeeklyReportPage';
export { TodoOverviewPage } from './todos/TodoOverviewPage';
export { ExpensePage } from './expenses/ExpensePage';

// Phase 4: Documents
export { DocumentsPage } from './documents/DocumentsPage';
export { QuotationInvoiceBuilder } from './documents/QuotationInvoiceBuilder';

// Phase 5: Chat
export { ChatPanel } from './chat/ChatPanel';
export { ChatPage } from './chat/ChatPage';
