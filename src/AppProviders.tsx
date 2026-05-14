import { MantineProvider, createTheme } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";

type AppProvidersProps = {
  children: React.ReactNode;
};

const defaultColorScheme = "light";
const notificationPosition = "top-right";

export const appTheme = createTheme({
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  primaryColor: "gray",
  defaultRadius: "sm",
  headings: {
    fontWeight: "650"
  },
  components: {
    Button: {
      defaultProps: {
        radius: "sm"
      }
    },
    Paper: {
      defaultProps: {
        radius: "sm",
        withBorder: true
      }
    }
  },
  other: {
    decisionRecord: "ADR-0009"
  }
});

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <MantineProvider
      defaultColorScheme={defaultColorScheme}
      forceColorScheme={defaultColorScheme}
      theme={appTheme}
    >
      <ModalsProvider>
        {children}
        <Notifications position={notificationPosition} />
      </ModalsProvider>
    </MantineProvider>
  );
}
