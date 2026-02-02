import { serve } from "inngest/next";
import { inngest } from "../../../utility/inngest/client";
import { processEmailThread } from "../../../utility/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processEmailThread],
});