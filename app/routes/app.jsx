// Deprecated embedded admin — replaced by the standalone admin at /.
import { redirect } from "@remix-run/node";
export const loader = () => redirect("/");
export default function AppLayout() { return null; }
