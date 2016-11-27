var EJSON = require('ejson');
var Payline = require('../dist/Payline.js');

describe('Payline', function() {
  describe('#doWebPayment()', function() {

    it('should be good', function(done) {
      const payline = new Payline('34887093267373', 'GQUCLWqtzdEAC8O7PDua', 'https://services.payline.com/V4/services/DirectPaymentAPI?wsdl');

      payline.runAction('doWebPayment', {
        payment: {
          attributes: {
            'xsi_type': {
              type: 'payment',
              xmlns: 'http://obj.ws.payline.experian.com'
            }
          },
          amount: 123,
          currency: 978,
          action: 101,
          mode: 'CPT',
          contractNumber: '1234567'
        },
        returnURL: 'https://google.com',
        cancelURL: 'http://google.com',
        order: {
          ref: '1576576',
          amount: 123,
          currency: 978,
          date: '20/06/2015 20:21'
        },
        selectedContractList: null,
        buyer: {}
      })
      .then(result => {
        console.log('Youpla! Redirect to: ' + EJSON.stringify(result));
        done();
      })
      .catch(error => {
        console.log(error);
        done();
      });
    });

    it('describe action', function(done) {

      const payline = new Payline('34887093267373', 'GQUCLWqtzdEAC8O7PDua', 'https://services.payline.com/V4/services/DirectPaymentAPI?wsdl');

      payline.describe()
      .then(result => {
        done();
      })
      .catch(error => {
        console.log(error);
      });
    });
  });
});
