// test-paper.js
const paper = require('paper');
paper.setup(new paper.Size(100, 100));

const circle = new paper.Path.Circle(new paper.Point(50, 50), 25);
const rect = new paper.Path.Rectangle(new paper.Point(50, 50), new paper.Size(50, 50));

const union = circle.unite(rect);
console.log(union.pathData);
