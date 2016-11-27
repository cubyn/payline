# Payline
> Fork of cubyn/payline

I choose to refine the package entirely.

## Usage

Where to find those f**** config strings? Well I've been there:

- `userId` is sent by email when you subscribe to Payline. joyfully named _Vendor identifier_ or _Merchant's Login_ elsewhere in their admin
- `userPass` is called _access key_ and available in Settings > Change your access key
- `url wsdl` is working now!

```
npm install flav-payline
```

``` javascript
var Payline = require('flav-payline');
var payline = new Payline('<% userId %>', '<% userPass %>', '<% url wsdl (optional) %>');
```

## Example using doWebPayment

``` javascript
payline.runAction('doWebPayment', {
    payment: {
    attributes: {
      xsi_type: {
          type: "payment"
          xmlns: "http://obj.ws.payline.experian.com"
        }
      },
      amount: 123,
      currency: 978,
      action: 101,
      mode: "CPT",
      contractNumber: "1234567"
     },
     returnURL: "https://google.com",
     cancelURL: "http://google.com",
     order: {
      ref: "1576576",
      amount: 123,
      currency: 978,
      date: "20/06/2015 20:21"
     },
     selectedContractList: null,
     buyer: {}
   })
  .then(function (result) {
    console.log("Youpla! Redirect to: " + result.redirectURL);
  }, function (err) {
    console.log("Wtf happened: " + err.shortMessage + ' - ' + err.longMessage);
  });
```

## API

##### `new Payline(userId, userPass) -> instance`
> See Usage to find those variables
> You can override the wsdl bundled in this module by setting a 3th arg : `new Payline(userId, userPass, 'my file path or url')`

##### `instance.runAction(doWebPayment, object) -> Promise(object)`
> Use the method describe to see wich methods is available with your wsdl.

##### `instance.describe() -> Promise(string)`
