import { AdminLivenessPage } from "./account/AdminLivenessPage";
import { DashboardPage } from "./account/DashboardPage";
import { DevicePage } from "./account/DevicePage";
import { LoginPage } from "./account/LoginPage";
import { PassNewPage } from "./account/PassNewPage";
import { SettingsPage } from "./account/SettingsPage";
import { DesignPage } from "./site/DesignPage";
import { DocsPage } from "./site/DocsPage";
import { HomePage } from "./site/HomePage";
import { DPA, PRIVACY, TERMS } from "./site/legal";
import { LegalPage } from "./site/LegalPage";
import { Missing } from "./site/Missing";

interface AppProps {
  readonly path: string;
}

export function App({ path }: AppProps): React.JSX.Element {
  switch (path) {
    case "/":
      return <HomePage />;
    case "/login":
      return <LoginPage />;
    case "/dashboard":
      return <DashboardPage />;
    case "/device":
      return <DevicePage />;
    case "/settings":
      return <SettingsPage />;
    case "/pass/new":
      return <PassNewPage />;
    case "/admin/liveness":
      return <AdminLivenessPage />;
    case "/docs":
      return <DocsPage />;
    case "/privacy":
      return <LegalPage document={PRIVACY} />;
    case "/dpa":
      return <LegalPage document={DPA} />;
    case "/terms":
      return <LegalPage document={TERMS} />;
    case "/design":
      return <DesignPage />;
    default:
      return <Missing />;
  }
}
