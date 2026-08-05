import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QuotaService } from './quota.service';
import { QuotaAccount, QuotaAccountSchema } from './schemas/quota-account.schema';
import { QuotaTransaction, QuotaTransactionSchema } from './schemas/quota-transaction.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: QuotaAccount.name, schema: QuotaAccountSchema },
    { name: QuotaTransaction.name, schema: QuotaTransactionSchema },
  ])],
  providers: [QuotaService],
  exports: [QuotaService],
})
export class QuotaModule {}
