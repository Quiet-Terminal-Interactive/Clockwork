import { packageId as ecsPackageId } from '@clockwork/ecs'

const root = document.querySelector<HTMLDivElement>('#app')

if (!root) {
  throw new Error('App root element is missing')
}

root.textContent = `Clockwork shell booting with ${ecsPackageId}`
