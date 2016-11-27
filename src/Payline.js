import soap from 'soap';
import path from 'path';

const DEFAULT_WSDL = path.join(__dirname, 'WebPaymentAPI.v4.44.wsdl');

export default class Payline {

  constructor(user, pass, wsdl = DEFAULT_WSDL) {
      if (!user || !pass || !contractNumber) {
          throw new Error('All of user / pass / contractNumber should be defined');
      }
      this.user = user;
      this.pass = pass;
      this.contractNumber = contractNumber;
      this.wsdl = wsdl;
  }

  initialize() {
    if (!this.__initializationPromise) {
        this.__initializationPromise = new Promise((resolve, reject) => {
          soap.createClient(this.wsdl, (error, client) => {
          if (error) {
            reject(error);
          } else {
            client.setSecurity(new soap.BasicAuthSecurity(this.user, this.pass));
            resolve(client);
          }
        });
      });
    }
    return this.__initializationPromise;
  }

  runAction(action, args) {
    return this.initialize()
      .then(client => {
        return new Promise((resolve, reject) => {
          client[action](args, (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          });
        });
      })
      .catch(error => {
        if (error.message === 'client[action] is not a function') {
          throw 'Action not found. See the methods payline.describe().';
        } else {
          throw error.message;
        }
      });
  }

  describe(action, args) {
    return this.initialize()
    .then(client => {
      return client.describe();
    });
  }
}
