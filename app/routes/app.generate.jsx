import { redirect } from "@remix-run/node";
export const loader = () => redirect("/");
export default function Page() { return null; }
