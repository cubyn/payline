import {PaylineCore} from "./core";
import {
    ACTIONS,
    Card,
    CURRENCIES,
    MIN_AMOUNT,
    MODE,
    Order,
    Owner,
    Payment,
    SuccessResult,
    TransactionResult,
    ValidationResult,
    Wallet,
    WalletResult,
} from "./model";


export default class Payline extends PaylineCore {

    public defaultCurrency: CURRENCIES = CURRENCIES.USD;
    public defaultMode: MODE = MODE.CPT;
    public defaultReferencePrefix: string = "order_";

    private setOrderDefaults(order: Order, referencePrefix?: string, currency?: CURRENCIES, amount: number = 0): Order {
        order.date = order.date || new Date(); // now if date not exist
        order.ref = order.ref || `${referencePrefix || this.defaultReferencePrefix}${this.generateId()}`;
        order.currency = order.currency || currency || this.defaultCurrency;
        order.amount = order.amount || amount;
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
        return {id: raw.transaction && raw.transaction.id, raw,}
    }

    protected generateWallet(walletId: string, card: Card): Wallet {
        return {
            walletId,
            card,
        };
    }

    public generateId(): string {
        return `${Math.ceil(Math.random() * 100000)}`;
    }

    public async createWallet(walletId, card: Card, owner?: Owner): Promise<WalletResult> {
        const raw = await this.runAction("createWallet", {
            contractNumber: this.contractNumber,
            wallet: this.generateWallet(walletId, card),
            owner,
        });
        return { wallet: walletId, raw, };
    }

    public async updateWallet(walletId, card: Card, owner?: Owner): Promise<WalletResult> {
        const raw = await this.runAction("updateWallet", {
            contractNumber: this.contractNumber,
            wallet: this.generateWallet(walletId, card),
            owner,
        });
        return {wallet: walletId, raw,};
    }

    public async getWallet(walletId): Promise<WalletResult> {
        const raw = await this.runAction("getWallet", {
            contractNumber: this.contractNumber,
            walletId
        });
        return {wallet: walletId, raw,};
    }

    public async disableWallet(walletId): Promise<SuccessResult> {
        const raw = await this.runAction("disableWallet", {
            contractNumber: this.contractNumber,
            walletIdList: [walletId],
        });
        return {success: true, raw};
    }

    public async transactionDetail(transactionId): Promise<TransactionResult> {
        const raw = await this.extractTransactionalResult(await this.runAction("getTransactionDetails", {
            transactionId,
        }));
        return raw;
    }

    public async doWalletPayment(walletId, payment: Payment, referencePrefix?: string,
                                 currency?: CURRENCIES, order: Order = {}): Promise<any> {
        this.setPaymentDefaults(payment, ACTIONS.PAYMENT, currency);
        this.setOrderDefaults(order, referencePrefix, currency, payment.amount);
        const raw: any = await this.extractTransactionalResult(await this.runAction("doImmediateWalletPayment", {
            payment,
            order,
            walletId,
        }));
        return raw;
    }

    public async scheduleWalletPayment(walletId, payment: Payment, scheduledDate: Date, referencePrefix?: string,
                                       currency?: CURRENCIES, order: Order = {}): Promise<any> {
        this.setPaymentDefaults(payment, ACTIONS.PAYMENT, currency);
        this.setOrderDefaults(order, referencePrefix, currency, payment.amount);
        const raw: any =  this.extractTransactionalResult(await this.runAction("doScheduledWalletPayment", {
            payment,
            order,
            walletId,
            scheduledDate,
        }));
        raw.id = raw.paymentRecordId || null;
        return raw;
    }

    public async doAuthorization(payment: Payment, card: Card, referencePrefix?: string,
                                 currency?: CURRENCIES, order: Order = {}): Promise<TransactionResult> {
        this.setPaymentDefaults(payment, ACTIONS.AUTHORIZATION, currency);
        this.setOrderDefaults(order, referencePrefix, currency, payment.amount);
        return this.extractTransactionalResult(await this.runAction("doAuthorization", {
            payment,
            order,
            card,
        }));
    }

    public async doReAuthorization(transactionID: string, payment: Payment, card: Card, referencePrefix?: string,
                                   currency?: CURRENCIES, order: Order = {}): Promise<TransactionResult> {
        this.setPaymentDefaults(payment, ACTIONS.AUTHORIZATION, currency);
        this.setOrderDefaults(order, referencePrefix, currency, payment.amount);
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

    public async doRefund(transactionID: string, payment: Payment,
                         comment: string = "Transaction refound"): Promise<TransactionResult> {
        return this.extractTransactionalResult(await this.runAction("doRefund", {
            transactionID,
            payment,
            comment,
        }));
    }

    public async validateCard(payment: Payment, card: Card, referencePrefix?: string,
                              currency?: CURRENCIES, order: Order = {}): Promise<ValidationResult> {
        // 1 is the minimum here
        order.amount = Math.max(payment.amount, MIN_AMOUNT);
        let authorization: any = null;
        try {
            authorization = await this.doAuthorization(payment, card, referencePrefix, currency, order);
        } catch {
            return {success: false, raw: {authorization, reset: null}};
        }

        const reset = await this.doReset(authorization && authorization.id);
        return {success: true, raw: {authorization, reset}}
    }

    public async doWebPayment(payment: Payment, returnURL, cancelURL, buyer: any = {}, selectedContractList: any = null,
                              referencePrefix?, currency?, order: Order = {}): Promise<TransactionResult> {
        this.setPaymentDefaults(payment, ACTIONS.PAYMENT, currency);
        this.setOrderDefaults(order, referencePrefix, currency, payment.amount);
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
