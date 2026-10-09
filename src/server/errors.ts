/** An error with an HTTP status, safe to show to the client. */
export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const notFound = (what = "That") => new HttpError(404, "not_found", `${what} wasn't found.`);
export const forbidden = (message = "You don't have access to that.") => new HttpError(403, "forbidden", message);
