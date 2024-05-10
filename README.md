## Sequencer UDP

### Heartbeat

You will be removed from the Sequencer's UDP client list if you dont send a heartbeat atleast every 3 minutes

```json
{
  "op": 10
}
```

The sequencer will then respond with OP 11 ACK

```json
{
  "op": 11
}
```

### Transaction

Aslong as you are connected to the Sequencer's UDP client list, it will send you every new transaction

```json
{
    "op": 20,
    "transaction": cborData
}
```
