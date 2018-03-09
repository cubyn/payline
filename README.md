# TS-Payline
> NodeJS/TypeScript SDK for payline.com API

This provides a very succinct SDK for the payline.com API using TypeScript. It's influenced by [cubyn/payline](cubyn/payline) and
completely rewritten using TypeScript, ES6 and tested with unit tests.

## Usage

Where to find the config strings? It's here:

- `merchantId` is sent by email when you subscribe to Payline. joyfully named _Vendor identifier_ or _Merchant's Login_ elsewhere in their admin
- `accessKey` is called _access key_ and available in Settings > Change your access key
- `contractId` is related to a point of sale and a method of payment. So once you created a _point of sale_, head to _method of payment_ and you will get a contract number after that. In the test mode, '1234567' seems to be accepted by default
- `environment` is witch environemnt use ('homologation', 'production'). Homologation is set by default.

```
yarn add tg-payline
```

``` javascript
import {Payline} from "ts-payline"
const payline = new Payline(merchantId, accessKey, contractId, environment)
```

## Example

``` javascript
import {Card, CURRENCIES, Payment} from "ts-payline";
// parameters to the payment
const card: Card = {
    cardholder: "John Doe",
    number: "4242424242424242", // test valid card
    expirationDate: new Date(startDate.getTime() + 1000 * 60 * 60 * 24), // experied in 1 day
    cvx: "123",
    type: "CB",
};
const payment: Payment = {
    amount: 9743,
    softDescriptor: "payment test description"
};
const walletId: string = "ID_PREFIX_" + payline.generateId();
// creation of the wallet
const {wallet, ...walletRest} = await payline.createWallet(walletId, card);
// change default currency into EUR
payline.defaultCurrency = CURRENCIES.EUR;
// issue an order
const {id, ...paymentRest} = await payline.doWalletPayment(wallet, payment, "payment_name_prefix_");
console.log(`DONE! Transaction id: ${id}`);
// get transaction details
const details = await payline.transactionDetails(id);
```

If transaction is not succeed error will be throw, so it's possible to catch it using try/catch.

## Example using doWebPayment

``` javascript
const {url, ...webRest} = await payline.doWebPayment(payment, "https://example.com/success", 
        "https://example.com/cancel", {}, null, "web_payment_name_");
console.log(`DONE! Redirect to url: ${url}`);
```

## Example of raw payline API call

``` javascript
// call raw action with parameters into payline
const raw = await this.runAction("getTransactionDetails", {
    transactionId,
});
console.log(`DONE! Raw response: ${JSON.stringify(raw)}`);
```

## API examples

You can find examples of the usage in a [test file](https://github.com/tgorka/payline/blob/master/src/payline.spec.ts)

## API

##### `new Payline(merchantId, accessKey, contractId, environment="homologation") -> instance`
> See Usage to find those variables

##### `instance.createWallet(walletId, card) -> Promise({ wallet })`
> Create new wallet - needs to generate id first.

##### `instance.updateWallet(walletId, card) -> Promise({ wallet })`
> Card object: `{ number, type, expirationDate, cvx }`

> Type: One of `CB`, `AMEX`, `VISA` (but abroad France only), `MASTERCARD` (same) - cf page 148 of their doc

##### `instance.getWallet(walletId) -> Promise(wallet)`
> Get information for the wallet

##### `instance.disableWallet(walletId) -> Promise()`
> Disabling wallet

##### `instance.doWalletPayment(walletId, payment, "optional_text") -> Promise({ id })`
> Note that amounts are in cents

##### `instance.doAuthorization(payment, card, "authorization_name_") -> Promise({ id })`
> Authorization hold operations

##### `instance.doReAuthorization(id, "reauthorization_name_") -> Promise({ id })`
> Renew hold

##### `instance.doCapture(id, payment) -> Promise({ id })`
> Capture part/full of the hold amount

##### `instance.doRefund(id, payment, "refund_name_") -> Promise({ id })`
> Refund amount after payment/capture has been done

##### `instance.doReset(id, payment, "reset_name_") -> Promise({ id })`
> Reset the authorization hold

##### `instance.transactionDetail(id) -> Promise(transaction)`
> Information about the transaction (payment, authorization, reauthorization, ...)

##### `instance.validateCard(payment, card, "card_validation_name_") -> Promise({ success: boolean})`
> Check if card is ok for the payment. It's a shortcut for making authorization and reset it after.

##### `instance.scheduleWalletPayment(wallet, payment, scheduleDate, "schedule_payment_name_") -> Promise({ id })`
> Schedule the payment on the scheduleDate

##### `instance.runAction(actionName, {...actionParameters}) -> Promise(raw)`
> Raw call into the payline API

## Tests

set env variables for the 'homologation' env and run the tests

```
export MERCHANT_ID='XXX'
export ACCESS_KEY='XXX'
export CONTRACT_ID='01234567'
yarn test
```

## Serverless

There is prepared configuration with use of [serverless framework](https://serverless.com/). 
Tested serverless provider is `aws`, but it should work in any others.

#### direct deployment
To deploy after login into the serverless and set aws credentials:

```
yarn deploy
```

#### CodeBuild deployment
There is basic preconfigured template for `AWS CodeBuild` deploymenet: `buildspec.yml`.

#### Customization
Clone this repository and update your custom configuration.

#### Default configurations
Default configuration values are stored in `environemtn/master.yml`
You can change it after cloning the repository as well as creating file for each
git branch for keeping track of the credential in different environments.

## Author
Tomasz Górka <http://tomasz.gorka.org.pl>
influenced bu the library [cubyn/payline](cubyn/payline)

## License
&copy; 2018 Tomasz Górka

MIT licensed.
