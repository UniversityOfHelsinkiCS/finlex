import * as Sentry from "@sentry/react";

/*
if you are getting duplicate sentry errors, remember to feed an environment variable to init to make apart different staging or production environments
*/
export const initSentry = () => {
  console.log("sentry started")
  Sentry.init({
    dsn: "https://3ceddfdc2ec34770c94e954ead69872b@toska.it.helsinki.fi/23",
    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    environment: 'production',
    sendDefaultPii: true,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration()
    ],
    // Tracing
    tracesSampleRate: 1.0, //  Capture 100% of the transactions
    // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
    tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
    // Session Replay
    replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
    replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.,
    // Enable logs to be sent to Sentry
    enableLogs: true
  });
}
// Add this button component to your app to test Sentry's error tracking
export const ErrorButton = () => {
  return (
    <button
      onClick={() => {
        // Send a log before throwing the error
        Sentry.logger.info('User triggered test error', {
          action: 'test_error_button_click',
        });
        throw new Error('This is your first error!');
      }}
    >
      Break the world
    </button>
  );
}
