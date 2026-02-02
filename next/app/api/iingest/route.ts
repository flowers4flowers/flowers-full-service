import { serve } from "inngest/next";
import { inngest } from "../../../utility/iingest/client";
import { processEmailThread } from "../../../utility/iingest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processEmailThread],
});