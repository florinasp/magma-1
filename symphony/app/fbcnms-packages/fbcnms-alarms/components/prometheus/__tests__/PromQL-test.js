/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

import * as PromQL from '../PromQL';

// Simple reusable PromQL Constructs to make tests cleaner
const simpleLabel = new PromQL.Label('label', 'value', '=');
const emptyLabels = new PromQL.Labels([]);
const singleLabels = new PromQL.Labels([simpleLabel]);
const basicSelector = new PromQL.InstantSelector('metric', emptyLabels);

describe('Label', () => {
  const testCases = [
    [
      'equal label',
      new PromQL.Label('label1', 'value1', '='),
      `label1="value1"`,
    ],
    [
      'not equal label',
      new PromQL.Label('label1', 'value1', '!='),
      `label1!="value1"`,
    ],
    [
      'regex label',
      new PromQL.Label('label1', 'value1', '=~'),
      `label1=~"value1"`,
    ],
    [
      'not regex label',
      new PromQL.Label('label1', 'value1', '!~'),
      `label1!~"value1"`,
    ],
  ];

  test.each(testCases)('%s', (_, label, expectedString) => {
    expect(label.toString()).toEqual(expectedString);
  });
});

describe('Labels', () => {
  const testCases = [
    ['single label', new PromQL.Labels([simpleLabel]), `{label="value"}`],
    [
      'multiple labels',
      new PromQL.Labels([simpleLabel, simpleLabel]),
      `{label="value",label="value"}`,
    ],
    ['no labels', new PromQL.Labels([]), ''],
  ];
  test.each(testCases)('%s', (_, labels, expectedString) => {
    expect(labels.toPromQL()).toEqual(expectedString);
  });
});

describe('Selectors', () => {
  const testCases = [
    [
      'simple metric',
      new PromQL.InstantSelector('metric', emptyLabels),
      `metric`,
    ],
    [
      'metric with label',
      new PromQL.InstantSelector('metric', singleLabels),
      `metric{label="value"}`,
    ],
    [
      'metric with multiple labels',
      new PromQL.InstantSelector(
        'metric',
        new PromQL.Labels([simpleLabel, simpleLabel]),
      ),
      `metric{label="value",label="value"}`,
    ],
    [
      'range selector',
      new PromQL.RangeSelector('metric', emptyLabels, new PromQL.Range(5, 'm')),
      `metric[5m]`,
    ],
  ];

  test.each(testCases)('%s', (_, instantSelector, expectedString) => {
    expect(instantSelector.toPromQL()).toEqual(expectedString);
  });
});

describe('Functions', () => {
  const testCases = [
    [
      'vector 1',
      new PromQL.Function('vector', [new PromQL.Scalar(1)]),
      `vector(1)`,
    ],
    [
      'clamp max (multiple arguments)',
      new PromQL.Function('clamp_max', [
        new PromQL.InstantSelector('metric', emptyLabels),
        new PromQL.Scalar(100),
      ]),
      `clamp_max(metric,100)`,
    ],
    [
      'sum of rate',
      new PromQL.AggregationOperation(
        'sum',
        new PromQL.Function('rate', [
          new PromQL.RangeSelector(
            'metric',
            emptyLabels,
            new PromQL.Range(5, 'm'),
          ),
        ]),
      ),
      'sum(rate(metric[5m]))',
    ],
  ];
  test.each(testCases)('%s', (_, f, expectedString) => {
    expect(f.toPromQL()).toEqual(expectedString);
  });
});

describe('Binary Operators', () => {
  const testCases = [
    [
      'addition',
      new PromQL.BinaryOperation(
        new PromQL.Scalar(1),
        new PromQL.Scalar(2),
        '+',
      ),
      '1 + 2',
    ],
    [
      'metric and metric',
      new PromQL.BinaryOperation(basicSelector, basicSelector, 'and'),
      'metric and metric',
    ],
    [
      'or ignoring labels',
      new PromQL.BinaryOperation(
        basicSelector,
        basicSelector,
        'or',
        new PromQL.Clause('ignoring', ['label']),
      ),
      `metric or ignoring (label) metric`,
    ],
  ];

  test.each(testCases)('%s', (_, binOp, expectedString) => {
    expect(binOp.toPromQL()).toEqual(expectedString);
  });
});

describe('Aggregation Operators', () => {
  const testCases = [
    [
      'sum by label',
      new PromQL.AggregationOperation(
        'sum',
        basicSelector,
        '',
        new PromQL.Clause('by', ['label']),
      ),
      'sum(metric) by (label)',
    ],
    [
      'sum by multiple labels',
      new PromQL.AggregationOperation(
        'sum',
        basicSelector,
        '',
        new PromQL.Clause('by', ['label1', 'label2']),
      ),
      'sum(metric) by (label1,label2)',
    ],
    [
      'topk with parameter',
      new PromQL.AggregationOperation('topk', basicSelector, '5'),
      'topk(5,metric)',
    ],
  ];

  test.each(testCases)('%s', (_, aggOp, expectedString) => {
    expect(aggOp.toPromQL()).toEqual(expectedString);
  });
});

describe('realistic examples', () => {
  const testCases = [
    [
      'aggregated threshold expression',
      new PromQL.BinaryOperation(
        new PromQL.AggregationOperation(
          'avg',
          new PromQL.Function('rate', [
            new PromQL.RangeSelector(
              'http_status',
              new PromQL.Labels([new PromQL.Label('code', '500', '=')]),
              new PromQL.Range(5, 'm'),
            ),
          ]),
          '',
          new PromQL.Clause('by', ['region']),
        ),
        new PromQL.Scalar(5),
        '>',
      ),
      `avg(rate(http_status{code="500"}[5m])) by (region) > 5`,
    ],
  ];

  test.each(testCases)('%s', (_, exp, expectedString) => {
    expect(exp.toPromQL()).toEqual(expectedString);
  });
});