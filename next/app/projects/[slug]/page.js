import { getProjectData } from "@/queries/projectQuery"
import ProjectContent from "@/components/ProjectContent"

export default async function Project({ params }) {
  const { slug } = params

  const data = await getProjectData(slug)

  return (
    <ProjectContent data={data} />
  )
}
