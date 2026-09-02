# Legacy pre-split deployments

This is historical evidence only. It is deliberately not named
`Published.toml`, so Sui tooling cannot bind the rewritten source package to
these immutable deployments.

| Network | Chain ID | Package ID | Version | Toolchain |
| --- | --- | --- | --- | --- |
| Mainnet | `4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S` | `0xe9b70375353ec0ed99e9ef2a4e51e70087db042ceba4631430cc2d7217b7fdcf` | 1 | 1.78.1 |
| Testnet | `69WiPg3DAQiwdxfncX6wYQ2siKwAe6L9BZthQea3JNMD` | `0x3013ca910b7571a5d19b215cce1037ea0061ba844831ea7013ce1b37303ec0ca` | 1 | 1.78.1 |

Both packages contain the pre-split `ori::data::Confidentiality` API. Neither
contains `ori::confidentiality`, and both are immutable.
