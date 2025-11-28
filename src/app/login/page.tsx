import LoginClient from "./LoginClient";

const errorMessages: Record<string, string> = {
  OAuthSignin: "Error constructing the authorization URL.",
  OAuthCallback: "Error during sign-in with Google.",
  OAuthCreateAccount: "Could not create your account.",
  EmailCreateAccount: "Could not create your account with email.",
  Callback: "Error in sign-in callback.",
  OAuthAccountNotLinked:
    "This Google account is not linked. Try another account or contact support.",
  EmailSignin: "Error sending the email.",
  CredentialsSignin: "Invalid credentials.",
  SessionRequired: "You must be signed in to access this page.",
  AccessDenied: "You do not have access to sign in.",
  Configuration: "There is a problem with the server configuration.",
  Verification: "The verification token is invalid or has expired.",
  Default: "Unable to sign in. Please try again.",
};

type LoginPageProps = {
  searchParams?: { error?: string };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  const errorKey = searchParams?.error;
  const errorMessage = errorKey
    ? errorMessages[errorKey] || errorMessages.Default
    : null;

  return <LoginClient errorMessage={errorMessage} />;
}
