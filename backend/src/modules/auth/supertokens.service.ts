import { Injectable, OnModuleInit } from '@nestjs/common';
import SuperTokens from 'supertokens-node';
import { getSuperTokensConfig } from './supertokens.config';

let initialized = false;

export function ensureSuperTokensInitialized() {
  if (!initialized) {
    SuperTokens.init(getSuperTokensConfig());
    initialized = true;
  }
}

@Injectable()
export class SuperTokensService implements OnModuleInit {
  onModuleInit() {
    ensureSuperTokensInitialized();
  }
}
