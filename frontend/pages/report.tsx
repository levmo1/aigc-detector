import { useParams } from 'react-router-dom'
import { ReportView } from '@/frontend/components/report-view'

export default function ReportPage() {
  const { id } = useParams()
  return <ReportView taskId={id ?? ''} />
}
