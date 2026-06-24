interface ErrorWithShortMessage {
  shortMessage?: string;
  message?: string;
}

export function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const maybeError = error as ErrorWithShortMessage;

    if (maybeError.shortMessage) {
      return maybeError.shortMessage;
    }

    if (maybeError.message) {
      return maybeError.message.split("\n")[0];
    }
  }

  if (error instanceof Error && error.message) {
    return error.message.split("\n")[0];
  }

  return "La operacion no pudo completarse.";
}
