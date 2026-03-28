/**
 * Adapter that converts a protobuf-ts `ServiceType` into a nice-grpc
 * compatible `ServiceDefinition`.
 *
 * nice-grpc natively supports ts-proto and grpc-js service definitions but
 * not protobuf-ts. This adapter bridges the gap by mapping each method's
 * `I.toBinary()` / `I.fromBinary()` to the `requestSerialize` /
 * `requestDeserialize` / `responseSerialize` / `responseDeserialize` shape
 * that nice-grpc expects.
 */

import type { ServiceType } from "@protobuf-ts/runtime-rpc";
import type { ServiceDefinition } from "nice-grpc";

/**
 * Convert a protobuf-ts `ServiceType` into a nice-grpc `ServiceDefinition`.
 *
 * The returned object can be passed directly to
 * `createClientFactory().create(definition, channel)`.
 */
export function fromProtobufTsService(
  serviceType: ServiceType,
): ServiceDefinition {
  const definition: Record<string, unknown> = {};

  for (const method of serviceType.methods) {
    definition[method.localName] = {
      path: `/${serviceType.typeName}/${method.name}`,
      requestStream: method.clientStreaming,
      responseStream: method.serverStreaming,
      requestSerialize: (value: unknown) =>
        method.I.toBinary(value as Parameters<typeof method.I.toBinary>[0]),
      requestDeserialize: (bytes: Uint8Array) => method.I.fromBinary(bytes),
      responseSerialize: (value: unknown) =>
        method.O.toBinary(value as Parameters<typeof method.O.toBinary>[0]),
      responseDeserialize: (bytes: Uint8Array) => method.O.fromBinary(bytes),
      options: {
        idempotencyLevel: method.idempotency,
      },
    };
  }

  return definition as ServiceDefinition;
}
