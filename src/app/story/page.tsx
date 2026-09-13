import { redirect } from "next/navigation";

export default function StoryRedirectPage() {
  redirect("/chat?tab=memories");
}
