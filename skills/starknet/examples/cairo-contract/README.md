# Cairo Smart Contract Examples

Working Cairo contract examples for StarkNet. All examples use Cairo 2.x syntax with Scarb.

## Basic Storage Contract

```cairo
#[starknet::interface]
pub trait IStorage<TContractState> {
    fn get_value(self: @TContractState) -> felt252;
    fn set_value(ref self: TContractState, value: felt252);
}

#[starknet::contract]
pub mod StorageContract {
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        value: felt252,
    }

    #[constructor]
    fn constructor(ref self: ContractState, initial_value: felt252) {
        self.value.write(initial_value);
    }

    #[abi(embed_v0)]
    impl StorageImpl of super::IStorage<ContractState> {
        fn get_value(self: @ContractState) -> felt252 {
            self.value.read()
        }

        fn set_value(ref self: ContractState, value: felt252) {
            self.value.write(value);
        }
    }
}
```

## ERC-20 Token

Using OpenZeppelin Cairo contracts for a production-ready token.

```toml
# Scarb.toml dependencies
[dependencies]
starknet = ">=2.9.0"
openzeppelin_token = "0.20.0"
openzeppelin_access = "0.20.0"
```

```cairo
#[starknet::contract]
pub mod MyToken {
    use openzeppelin_token::erc20::{ERC20Component, ERC20HooksEmptyImpl};
    use openzeppelin_access::ownable::OwnableComponent;
    use starknet::ContractAddress;

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    #[abi(embed_v0)]
    impl ERC20MixinImpl = ERC20Component::ERC20MixinImpl<ContractState>;
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;

    #[abi(embed_v0)]
    impl OwnableMixinImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        ERC20Event: ERC20Component::Event,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        name: ByteArray,
        symbol: ByteArray,
        initial_supply: u256,
        owner: ContractAddress,
    ) {
        self.erc20.initializer(name, symbol);
        self.ownable.initializer(owner);
        self.erc20.mint(owner, initial_supply);
    }

    #[external(v0)]
    fn mint(ref self: ContractState, to: ContractAddress, amount: u256) {
        self.ownable.assert_only_owner();
        self.erc20.mint(to, amount);
    }
}
```

## Interface Definition

Interfaces define the contract's external API. The generic `TContractState` parameter determines read vs write access.

```cairo
#[starknet::interface]
pub trait IVault<TContractState> {
    // @TContractState = read-only (view)
    fn get_balance(self: @TContractState, user: ContractAddress) -> u256;
    fn get_total_deposits(self: @TContractState) -> u256;

    // ref TContractState = state-mutating (external)
    fn deposit(ref self: TContractState, amount: u256);
    fn withdraw(ref self: TContractState, amount: u256);
}
```

Interfaces generate dispatcher types automatically:
- `IVaultDispatcher` — for calling from external code/tests
- `IVaultDispatcherTrait` — the trait to import for calling methods
- `IVaultLibraryDispatcher` — for library calls (like delegatecall)

## Events

Events are defined as enum variants with struct bodies. `#[key]` marks indexed fields.

```cairo
#[event]
#[derive(Drop, starknet::Event)]
pub enum Event {
    Deposited: Deposited,
    Withdrawn: Withdrawn,
    OwnerChanged: OwnerChanged,
}

#[derive(Drop, starknet::Event)]
pub struct Deposited {
    #[key]
    pub user: ContractAddress,
    pub amount: u256,
    pub timestamp: u64,
}

#[derive(Drop, starknet::Event)]
pub struct Withdrawn {
    #[key]
    pub user: ContractAddress,
    pub amount: u256,
}

#[derive(Drop, starknet::Event)]
pub struct OwnerChanged {
    #[key]
    pub previous: ContractAddress,
    #[key]
    pub new: ContractAddress,
}
```

Emit events from contract functions:

```cairo
self.emit(Deposited { user: caller, amount, timestamp: get_block_timestamp() });
```

## Component Pattern

Components are reusable modules that can be embedded into any contract. They are the Cairo equivalent of Solidity's inheritance.

### Defining a Component

```cairo
#[starknet::component]
pub mod PausableComponent {
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        paused: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Paused: Paused,
        Unpaused: Unpaused,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Paused {}

    #[derive(Drop, starknet::Event)]
    pub struct Unpaused {}

    #[embeddable_as(PausableImpl)]
    impl Pausable<
        TContractState, +HasComponent<TContractState>,
    > of super::IPausable<ComponentState<TContractState>> {
        fn is_paused(self: @ComponentState<TContractState>) -> bool {
            self.paused.read()
        }
    }

    #[generate_trait]
    pub impl InternalImpl<
        TContractState, +HasComponent<TContractState>,
    > of InternalTrait<TContractState> {
        fn assert_not_paused(self: @ComponentState<TContractState>) {
            assert(!self.paused.read(), 'Contract is paused');
        }

        fn pause(ref self: ComponentState<TContractState>) {
            self.paused.write(true);
            self.emit(Paused {});
        }

        fn unpause(ref self: ComponentState<TContractState>) {
            self.paused.write(false);
            self.emit(Unpaused {});
        }
    }
}
```

### Using the Component

```cairo
#[starknet::contract]
pub mod MyContract {
    use super::PausableComponent;

    component!(path: PausableComponent, storage: pausable, event: PausableEvent);

    #[abi(embed_v0)]
    impl PausableImpl = PausableComponent::PausableImpl<ContractState>;
    impl PausableInternalImpl = PausableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        pausable: PausableComponent::Storage,
        value: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        PausableEvent: PausableComponent::Event,
    }

    #[external(v0)]
    fn set_value(ref self: ContractState, new_value: u256) {
        self.pausable.assert_not_paused();
        self.value.write(new_value);
    }
}
```

## Storage Mapping Patterns

```cairo
use starknet::storage::Map;

#[storage]
struct Storage {
    // Simple mapping: address -> balance
    balances: Map<ContractAddress, u256>,

    // Nested mapping: (owner, spender) -> allowance
    allowances: Map<(ContractAddress, ContractAddress), u256>,

    // Using felt252 keys
    names: Map<felt252, ByteArray>,
}

// Reading and writing maps
fn transfer(ref self: ContractState, to: ContractAddress, amount: u256) {
    let caller = get_caller_address();
    let sender_balance = self.balances.read(caller);
    assert(sender_balance >= amount, 'Insufficient balance');
    self.balances.write(caller, sender_balance - amount);
    self.balances.write(to, self.balances.read(to) + amount);
}

// Nested map access
fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) {
    let owner = get_caller_address();
    self.allowances.write((owner, spender), amount);
}
```
