/*
 * Copyright 2018-2019 Unbounded Systems, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * AWS library for Adapt.
 * @beta
 */
export * from "./CFResource";
export * from "./credentials";
export {
    CFStack,
    CFStackProps,
    CFStackStatus,
} from "./CFStack";
export * from "./EC2Instance";
export * from "./EIPAssociation";

export { createAwsPlugin } from "./aws_plugin";
