import * as Sentry from "@sentry/react";

/*
if you are getting duplicate sentry errors, remember to feed an environment variable to init to make apart different staging or production environments
*/
export const initSentry = () => {
  console.log("sentry started")
  Sentry.init({
    dsn: "https://3ceddfdc2ec34770c94e954ead69872b@toska.it.helsinki.fi/23",
    sendDefaultPii: true,
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
