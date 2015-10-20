# Payline [![NPM version][npm-image]][npm-url]
> NodeJS SDK for payline.com API

This provides a very succinct SDK for the payline.com API. If you need additional Payline methods covered, feel free to contribute :-)
Highly inspired from [Django-Payline](https://github.com/magopian/django-payline), thanks!

As promised ([Bluebird](https://github.com/petkaantonov/bluebird) based).

## Usage

Where to find those f**** config strings? Well I've been there:

- `userId` is sent by email when you subscribe to Payline. joyfully named _Vendor identifier_ or _Merchant's Login_ elsewhere in their admin
- `userPass` is called _access key_ and available in Settings > Change your access key
- `contractNumber` is related to a point of sale and a method of payment. So once you created a _point of sale_, head to _method of payment_ and you will get a contract number after that. In the test mode, '1234567' seems to be accepted by default

```
npm install payline
```

``` javascript
var Payline = require('payline');
var payline = new Payline('<% userId %>', '<% userPass %>', '<% contractNumber %>');
```

## Example

``` javascript
payline.createWallet('wallet_0001', {
        number: '4970101122334471',
        type: 'CB',
        expirationDate: '0117',
        cvx: '123'
    })
    .then(function() {
        // issue a 10€ order
        return payline.makeWalletPayment('wallet_0001', 1000, Payline.CURRENCIES.EUR);
    })
    .then(function(result) {
        console.log("Youpi! Transaction id: " + result.transactionId);
    }, function(err) {
        console.log("Wtf happened: " + err.shortMessage + ' - ' + err.longMessage);
    });
```

## API

##### `new Payline(userId, userPass, contractNumber) -> instance`
> See Usage to find those variables

> You can override the wsdl bundled in this module by setting a 4th arg : `new Payline(userId, userPass, contractNumber, 'my file path or url')`

##### `instance.createWallet(walletId, card) -> Promise({ walletId })`
##### `instance.updateWallet(walletId, card) -> Promise({ walletId })`
> Card object: `{ number, type, expirationDate, cvx }`

> Type: One of `CB`, `AMEX`, `VISA` (but abroad France only), `MASTERCARD` (same) - cf page 148 of their doc

##### `instance.getWallet(walletId) -> Promise(wallet)`

##### `instance.makeWalletPayment(walletId, amount, currency = 978) -> Promise({ transactionId })`
> Note that amounts are in cents

##### `instance.validateCard(card, tryAmount = 100, currency = 978) -> Promise(bool)`
> Will try to issue a 1€ order (that will be cancelled right after the call is verified)

## Contributions


```
gulp watch

# this module is written in ES6 - so it has to be transpiled
# before being published to NPM

```
