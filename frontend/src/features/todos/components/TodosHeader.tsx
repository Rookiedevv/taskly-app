import { CheckCheck, Plus } from 'lucide-react'
import { Button, Heading, Text } from '../../../design-system'

export function TodosHeader({
  disabled,
  activeCount,
  onCreate,
  onCompleteAll,
}: {
  disabled: boolean
  activeCount: number
  onCreate: () => void
  onCompleteAll: () => void
}) {
  return (
    <section className="row spread" aria-labelledby="page-title">
      <div className="stack compact">
        <Heading id="page-title">Tasks</Heading>
        <Text muted>Create, organize, and complete tasks.</Text>
      </div>
      <div className="row">
        <Button
          variant="secondary"
          disabled={disabled || activeCount === 0}
          onClick={onCompleteAll}
          aria-label={
            activeCount > 0
              ? `Complete all ${activeCount} active tasks`
              : 'Complete all tasks'
          }
        >
          <CheckCheck size={18} aria-hidden="true" />
          Complete all
        </Button>
        <Button disabled={disabled} onClick={onCreate}>
          <Plus size={18} aria-hidden="true" />
          New task
        </Button>
      </div>
    </section>
  )
}
