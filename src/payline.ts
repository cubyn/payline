import * as soap from "soap";
import * as _debug from "debug";
import {
    ACTIONS,
    CURRENCIES,
    MODE,
    DEFAULT_ENDPOINTS_PREFIX,
    DEFAULT_WSDLS_PREFIX,
    DEFAULT_WSDLS_NAME,
    MIN_AMOUNT,
    Card,
    EnvironmentsProperty,
    Operation,
    OperationsProperty,
    Order,
    Owner,
    Payment,
    TransactionResult,
    ValidationResult,
    Wallet,
    SuccessResult,
    WalletResult,
    Environment,
} from "./model";


const debug = _debug("payline");

class PaylineCore {

    public paylineVersion: string = "18";

    private _soapClient: OperationsProperty<any | null> = {
        directPayment: null,
        webPayment: null,
        extended: null,
    };

    constructor(private merchantId: string, private accessKey: string, public contractNumber: string,
                public enviromnent: Environment,
                public endpointsPrefix: EnvironmentsProperty<string> = DEFAULT_ENDPOINTS_PREFIX,
                public wsdlsPrefix: EnvironmentsProperty<string> = DEFAULT_WSDLS_PREFIX,
                public wsdlsName: OperationsProperty<string> = DEFAULT_WSDLS_NAME,) {
    }

    protected wsdl(): string {
        return "";
    }

    protected soapParams(): {} {
        return {};
    }

    private async initializeAll(): Promise<void> {
        Object.keys(this._soapClient).forEach((operation: Operation) => {
            if (!this._soapClient[operation]) {
                this.initialize(operation);
            }
        });
    }

    /**
     * Initialize the SOAP client as a singleton by:
     * - getting WSDL files
     * - generating clinet object from WSDL files
     * - setting basic auth on the soap
     * - adding debug for the operations using debug lib with payline key
     * @return {Promise<any>} promise to the soap client
     */
    private async initialize(operation: Operation): Promise<void> {
        this._soapClient[operation] = await soap.createClientAsync(this.wsdl(), this.soapParams());
        const basicAuthSecurity = new soap.BasicAuthSecurity(this.merchantId, this.accessKey);

        this._soapClient[operation].setSecurity(basicAuthSecurity);
        this._soapClient[operation].on('request', (xml: string): void => {
            debug('REQUEST', xml);
        });
        this._soapClient[operation].on('response', (xml: string): void => {
            debug('RESPONSE', xml);
        });
    }

    private isResultSuccessful(result: any): boolean {
        return result && ['02500', '00000'].indexOf(result.code) !== -1;
    }

    private extractResult(result: any): any {
        return result.result || result;
    }

    /**
     * soap library has trouble loading element types
     * so we sometimes have to override inferred namespace
     * @param type
     * @returns {{xsi_type: {type: any; xmlns: string}}}
     */
    private namespace(type: string): any {
        return {
            xsi_type: {
                type,
                xmlns: "http://obj.ws.payline.experian.com",
            }
        };
    }

    private paylineDate(date: Date): String {
        const year = date.getFullYear().toString();
        const month = (date.getMonth() + 1).toString(); // getMonth() is zero-based
        const day = date.getDate().toString();
        const hour = date.getHours().toString();
        const minute = date.getMinutes().toString();
        // DD/MM/YYYY HH:mm
        return `${(day[1] ? day : `0${day[0]}`)}/${(month[1] ? month : `0${month[0]}`)}/${year} ${(hour[1] ? hour : `0${hour[0]}`)}:${(minute[1] ? minute : `0${minute[0]}`)}`;
    };

    private ensureAttributes(args: any): any {
        Object.keys(args).forEach(name => {
            if (args[name].constructor === Object) {
                args[name].attributes = args[name].attributes || this.namespace(name);
                args[name] = this.ensureAttributes(args[name]);
            }
            if (args[name].constructor === Array) {
                args[name].forEach(this.ensureAttributes.bind(this));
            }
            if (args[name].constructor === String && Date.parse(args[name]).constructor === Number) {
                args[name] = new Date(args[name]);
            }
            if (name === "expirationDate" && args[name] instanceof Date) {
                const year = args[name].getFullYear().toString();
                const month = (args[name].getMonth() + 1).toString(); // getMonth() is zero-based
                args[name] = `${(month[1] ? month : `0${month[0]}`)}${year.slice(-2)}`;
            }
            if (name === "expirationDate") {
                args[name] = args[name].replace("/", ""); // replace 12/07 to 1207
            }
            if (args[name] instanceof Date) {
                args[name] = this.paylineDate(args[name]);
            }
            if (name === "amout" && args[name] instanceof Number) {

            }
        });
        return args;
    }

    private async _runAction(client: any, action: string, args: any): Promise<any> {
        args.version = args.version || this.paylineVersion;
        const response = await new Promise<any>((resolve, reject) => {
            try {console.log("working")
                client[action](this.ensureAttributes(args), resolve);console.log("working done")
            } catch (error) {console.log("err", error)
                reject(error);
            }
        });
        const result = this.extractResult(response);

        if (this.isResultSuccessful(result)) {
            return { result: result, raw: response };
        } else {
            throw { result: result, raw: response };
        }
    }

    /**
     * Call any action that is defined in the WSDL files with the arguments
     * @param {string} action name of the action to call
     * @param args parameters of the call
     * @return {<any>} promise of the response from payline
     */
    public async runAction(action: string, args: any): Promise<any> {
        await this.initializeAll();
        const client = Object.values(this._soapClient)
            .find(client => !!client && !!client[action])
            ;//.pop();
        console.log("got client", JSON.stringify(client))
        if (!!client) {
            throw new Error("Wrong action for the API");
        }

        try {
            return this._runAction(client, action, args);
        } catch (error) {
            const response = error.response;
            if (response.statusCode === 401) {
                return Promise.reject({ shortMessage: "Wrong API credentials", paylineError: error });
            } else {
                return Promise.reject({ shortMessage: "Wrong API call", paylineError: error });
            }
        }
    }

}

export default class Payline extends PaylineCore {

    public defaultCurrency: CURRENCIES = CURRENCIES.USD;
    public defaultMode: MODE = MODE.CPT;
    public defaultReferencePrefix: string = "order_";

    public generateId(): string {
        return `${Math.ceil(Math.random() * 100000)}`;
    }

    private setOrderDefaults(order: Order, referencePrefix?: string): Order {
        order.date = order.date || new Date(); // now if date not exist
        order.ref = order.ref || `${referencePrefix || this.defaultReferencePrefix}${this.generateId()}`;
        return order;
    }

    private setPaymentDefaults(payment: Payment, action: ACTIONS, currency?: CURRENCIES): Payment {
        payment.mode = payment.mode || this.defaultMode;
        payment.action = action;
        payment.currency = payment.currency || currency || this.defaultCurrency;
        payment.contractNumber = this.contractNumber;
        return payment;
    }

    private extractTransactionalResult(raw: any): TransactionResult {
        return { id: raw.transaction && raw.transaction.id, raw, }
    }

    protected generateWallet(walletId: string, card: Card): Wallet {
        return {
            walletId,
            card,
        };
    }

    public async createWallet(walletId, card: Card, owner?: Owner): Promise<WalletResult> {
        const raw = await this.runAction("createWallet", {
            contractNumber: this.contractNumber,
            wallet: this.generateWallet(walletId, card),
            owner,
        });
        return { wallet: raw.wallet, raw, };
    }

    public async updateWallet(walletId, card: Card, owner?: Owner): Promise<WalletResult> {
        const raw = await this.runAction("updateWallet", {
            contractNumber: this.contractNumber,
            wallet: this.generateWallet(walletId, card),
            owner,
        });
        return { wallet: raw.wallet, raw, };
    }

    public async getWallet(walletId): Promise<WalletResult> {
        const raw = await this.runAction("getWallet", {
            contractNumber: this.contractNumber,
            walletId
        });
        return { wallet: raw.wallet, raw, };
    }

    public async disableWallet(walletId): Promise<SuccessResult> {
        const raw = await this.runAction("disableWallet", {
            contractNumber: this.contractNumber,
            walletIdList: [walletId],
        });
        return { success: true, raw };
    }

    public async doWalletPayment(walletId, payment: Payment, order: Order,
                                 referencePrefix?: string, currency?: CURRENCIES): Promise<any> {
        this.setPaymentDefaults(payment, ACTIONS.PAYMENT, currency);
        this.setOrderDefaults(order, referencePrefix);
        return this.extractTransactionalResult(await this.runAction("doImmediateWalletPayment", {
            payment,
            order,
            walletId,
        }));
    }

    public async scheduleWalletPayment(walletId, payment: Payment, order: Order, scheduledDate: Date,
                                 referencePrefix?: string, currency?: CURRENCIES): Promise<any> {
        this.setPaymentDefaults(payment, ACTIONS.PAYMENT, currency);
        this.setOrderDefaults(order, referencePrefix);
        return this.extractTransactionalResult(await this.runAction("doImmediateWalletPayment", {
            payment,
            order,
            walletId,
            scheduledDate,
        }));
    }

    public async doAuthorization(payment: Payment, order: Order, card: Card,
            referencePrefix?: string, currency?: CURRENCIES): Promise<TransactionResult> {
        this.setPaymentDefaults(payment, ACTIONS.AUTHORIZATION, currency);
        this.setOrderDefaults(order, referencePrefix);
        return this.extractTransactionalResult(await this.runAction("doAuthorization", {
            payment,
            order,
            card,
        }));
    }

    public async doReAuthorization(transactionID: string, payment: Payment, order: Order, card: Card,
                                   referencePrefix?: string, currency?: CURRENCIES): Promise<TransactionResult> {
        this.setPaymentDefaults(payment, ACTIONS.AUTHORIZATION, currency);
        this.setOrderDefaults(order, referencePrefix);
        return this.extractTransactionalResult(await this.runAction("doReAuthorization", {
            transactionID,
            payment,
            order,
        }));
    }

    public async doCapture(transactionID, payment: Payment, currency?: CURRENCIES): Promise<TransactionResult> {
        this.setPaymentDefaults(payment, ACTIONS.VALIDATION, currency);
        return this.extractTransactionalResult(await this.runAction("doCapture", {
            payment,
            transactionID,
        }));
    }

    public async doReset(transactionID: string,
            comment: string = "Card validation cleanup"): Promise<TransactionResult> {
        return this.extractTransactionalResult(await this.runAction("doReset", {
            transactionID,
            comment,
        }));
    }

    public async validateCard(payment: Payment, order: Order, card: Card,
                              referencePrefix?: string, currency?: CURRENCIES): Promise<ValidationResult> {
        // 1 is the minimum here
        order.amount = Math.max(order.amount, MIN_AMOUNT);
        let authorization: any = null;
        try {
            authorization = await this.doAuthorization(payment, order, card, referencePrefix, currency);
        } catch {
            return { success: false, raw: {authorization, reset: null} };
        }

        const reset = await this.doReset(authorization && authorization.transactionId);
        return { success: true, raw: {authorization, reset} }
    }

    public async doWebPayment(payment: Payment, order: Order, returnURL, cancelURL, buyer: any = {},
            selectedContractList: any = null, referencePrefix?, currency?): Promise<TransactionResult> {
        this.setPaymentDefaults(payment, ACTIONS.PAYMENT, currency);
        this.setOrderDefaults(order, referencePrefix);
        return this.extractTransactionalResult(await this.runAction("doWebPayment", {
            payment,
            returnURL,
            cancelURL,
            order,
            selectedContractList,
            buyer,
        }));
    }
}
