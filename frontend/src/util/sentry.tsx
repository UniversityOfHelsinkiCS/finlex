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
