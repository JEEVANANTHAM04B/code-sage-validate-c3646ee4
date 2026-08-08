import { createServerFn } from "@tanstack/react-start";

import {
  createSubmission,
  getSubmission,
  listSubmissions,
  submissionIdSchema,
  submissionInsertSchema,
} from "./submissions.server";

export const listSubmissionsFn = createServerFn({ method: "GET" }).handler(async () =>
  listSubmissions(),
);

export const getSubmissionFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => submissionIdSchema.parse(input))
  .handler(async ({ data }) => getSubmission(data.id));

export const createSubmissionFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => submissionInsertSchema.parse(input))
  .handler(async ({ data }) => createSubmission(data));
