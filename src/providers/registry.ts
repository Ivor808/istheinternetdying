import type { StatusProvider } from './types';

const providers = new Map<string, StatusProvider>();

export function registerProvider(provider: StatusProvider): void {
  providers.set(provider.type, provider);
}

export function getProvider(type: string): StatusProvider {
  const provider = providers.get(type);
  if (!provider) {
    throw new Error(`No provider registered for type: ${type}`);
  }
  return provider;
}
