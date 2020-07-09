import { createService, services, bootStrapService } from '../serviceFactory'
import { BlocksStatus } from '../classes/BlocksStatus'

const serviceConfig = services.STATUS

async function main () {
  try {
    const { log, db, initConfig, events } = await bootStrapService(serviceConfig)
    const Status = new BlocksStatus(db, { log, initConfig })
    const eventHandler = (event, data) => {
      switch (event) {
        case events.NEW_STATUS:
          Status.update(data)
          break
      }
    }
    const executor = ({ create }) => { create.Listener(eventHandler) }
    const { startService } = await createService(serviceConfig, executor, { log })
    await startService()
  } catch (err) {
    console.error(err)
    process.exit(9)
  }
}

main()
