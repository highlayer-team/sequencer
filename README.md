## Sequencer UDP

All UDP requests must be encoded using msgpack and decoded using msgpack

### Batch Transaction Requesting

In order to recieve many transaction at the same time you must send the UDP client this request

````json5
{
  op: 30, // Request identifier
  startingPoint: 0, // Starting point in the ledger
  amount: 1000, // Max transactions is 1000
}
```
You will then recieve UDP messages

```json5
{
  op: 31,
  transaction: encodedData,
  ledgerIndex: number,
}
```

### Heartbeat

You will be removed from the Sequencer's UDP client list if you dont send a heartbeat atleast every 3 minutes

```json
{
  "op": 10
}
````

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
    "op": 21,
    "transaction": encodedData
}
```
