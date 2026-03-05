# qti-neon-client

`qti-neon-client` provides the Neon networking client package for Clockwork.

It includes:

- Neon protocol packet header/payload encode/decode helpers
- Typed packet registry for game packet serialization
- Transport abstraction with mock and Tauri UDP implementations
- Client state machine with connect, reconnect, ping, and reliability handling
- Clockwork plugin integration for fixed-tick receive/send orchestration

---

## Install

JavaScript/TypeScript:

```bash
npm i qti-neon-client
```

---

## Register the Plugin

TypeScript:

```ts
import { AppBuilder } from 'qti-clockwork-app'
import { NeonPlugin, MockTransport } from 'qti-neon-client'

const [clientTransport] = MockTransport.createPair()

const app = new AppBuilder()
  .use(
    NeonPlugin({
      transport: clientTransport,
      playerName: 'PlayerOne',
      gameIdentifier: 0x1234
    })
  )
  .build()
```

JavaScript:

```js
import { AppBuilder } from 'qti-clockwork-app'
import { NeonPlugin, MockTransport } from 'qti-neon-client'

const [clientTransport] = MockTransport.createPair()

const app = new AppBuilder()
  .use(
    NeonPlugin({
      transport: clientTransport,
      playerName: 'PlayerOne',
      gameIdentifier: 0x1234
    })
  )
  .build()
```

For Neon integration see [https://projectneon-jd.quietterminal.co.uk](ProjectNeon docs)

---

## Packets and Registry

TypeScript:

```ts
import { NeonPacketRegistry, type PacketDescriptor } from 'qti-neon-client'

type Coord = { x: number; y: number }

const registry = new NeonPacketRegistry()

const coordDescriptor: PacketDescriptor<Coord> = {
  id: 0x10,
  name: 'Coord',
  serialize(payload, view, offset) {
    view.setFloat32(offset, payload.x, true)
    view.setFloat32(offset + 4, payload.y, true)
    return 8
  },
  deserialize(view, offset) {
    return {
      x: view.getFloat32(offset, true),
      y: view.getFloat32(offset + 4, true)
    }
  }
}

registry.register(coordDescriptor)
```

JavaScript:

```js
import { NeonPacketRegistry } from 'qti-neon-client'

const registry = new NeonPacketRegistry()

registry.register({
  id: 0x10,
  name: 'Coord',
  serialize(payload, view, offset) {
    view.setFloat32(offset, payload.x, true)
    view.setFloat32(offset + 4, payload.y, true)
    return 8
  },
  deserialize(view, offset) {
    return {
      x: view.getFloat32(offset, true),
      y: view.getFloat32(offset + 4, true)
    }
  }
})
```

For Neon integration see [https://projectneon-jd.quietterminal.co.uk](ProjectNeon docs)

---

## Client Usage

TypeScript:

```ts
import { NeonClient, MockTransport } from 'qti-neon-client'

const [clientTransport] = MockTransport.createPair()

const client = new NeonClient({
  transport: clientTransport,
  playerName: 'PlayerOne',
  gameIdentifier: 0x1234
})

await client.connect('127.0.0.1', 7777, 42)
client.processIncoming()
client.tickReliability(Date.now())
```

JavaScript:

```js
import { NeonClient, MockTransport } from 'qti-neon-client'

const [clientTransport] = MockTransport.createPair()

const client = new NeonClient({
  transport: clientTransport,
  playerName: 'PlayerOne',
  gameIdentifier: 0x1234
})

await client.connect('127.0.0.1', 7777, 42)
client.processIncoming()
client.tickReliability(Date.now())
```

For Neon integration see [https://projectneon-jd.quietterminal.co.uk](ProjectNeon docs)

---

## Notes

- `NeonPlugin` installs receive and send systems in `FixedUpdate` and stores client state in a resource.
- `MockTransport` is useful for deterministic tests and local packet-flow validation.
- `TauriUdpTransport` provides runtime UDP I/O when running in Tauri.
