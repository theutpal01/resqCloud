import { notFound } from "next/navigation";
import { Workspace } from "../../features/workspace/Workspace";
import { isWorkspaceSection } from "../../features/workspace/sections";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!isWorkspaceSection(section) || section === "overview") notFound();
  return <Workspace section={section} />;
}
