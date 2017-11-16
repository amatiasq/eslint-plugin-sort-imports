/**
 * @fileoverview Rule to require sorting of import declarations
 * @author A. Matías Quezada
 */

'use strict';

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
    meta: {
        docs: {
            description: 'enforce sorted import declarations within modules',
            category: 'ECMAScript 6',
            recommended: false
        },
        schema: [{
            type: 'object',
            properties: {
                sortMembers: {
                    type: 'boolean'
                },
                caseSensitive: {
                    type: 'boolean'
                }
            },
            additionalProperties: false
        }],
        fixable: 'code'
    },


    create(context) {
        const configuration = context.options[0] || {};
        const source = context.getSourceCode();
        const sortMembers = 'sortMembers' in configuration ? configuration.sortMembers : true;
        const caseSensitive = 'caseSensitive' in configuration ? configuration.caseSensitive : false;

        return {
            Program(node) {
                const imports = node.body.filter(isImportDeclaration);
                if (!imports) {
                    return;
                }


                if (sortMembers) {
                    imports.forEach((declaration) => {
                        const specifiers = declaration.specifiers.filter(isImportSpecifier);
                        const unsortedMemberIndex = specifiers
                            .map(getSpecifierName)
                            .findIndex(isSmallerThanPrevious);

                        if (unsortedMemberIndex !== -1) {
                            context.report({
                                node: specifiers[unsortedMemberIndex],
                                message: 'Expected "{{memberName}}" in import declaration to be sorted alphabetically.',
                                data: {memberName: specifiers[unsortedMemberIndex].local.name},
                                fix: fixImportMembers(specifiers)
                            });
                        }
                    });
                }


                imports.forEach((current, index, array) => {
                    if (index === 0) {
                        return;
                    }

                    const prev = array[index - 1];
                    const prevName = getModuleName(prev);
                    const currentName = getModuleName(current);

                    if (prevName === currentName) {
                        return context.report({
                            node,
                            message: 'Module {{currentName}} imported twice',
                            data: {currentName}
                        });
                    }

                    const isPrevEmpty = isEmptyImport(prev);
                    const isCurrentEmpty = isEmptyImport(current);
                    const isPrevAbsolute = isAbsolute(prevName);
                    const isCurrentAbsolute = isAbsolute(currentName);

                    if (isPrevEmpty && !isCurrentEmpty || isPrevAbsolute && !isCurrentAbsolute) {
                        return;
                    }

                    if (!isPrevEmpty && isCurrentEmpty) {
                        return context.report({
                            node,
                            message: 'Expected empty import {{currentName}} to be before import {{prevName}}',
                            data: {currentName, prevName},
                            fix: fixImportDefinitions(imports)
                        });
                    }

                    if (!isPrevAbsolute && isCurrentAbsolute) {
                        return context.report({
                            node,
                            message: 'Expected absolute module {{currentName}} to be before relative {{prevName}}',
                            data: {currentName, prevName},
                            fix: fixImportDefinitions(imports)
                        });
                    }

                    if (currentName < prevName) {
                        return context.report({
                            node,
                            message: 'Expected module {{currentName}} to be before module {{prevName}}',
                            data: {currentName, prevName},
                            fix: fixImportDefinitions(imports)
                        });
                    }
                });
            }
        };


        function fixImportMembers(specifiers) {
            return (fixer) => {
                const sorted = specifiers.slice().sort((specifierA, specifierB) => {
                    const aName = getSpecifierName(specifierA);
                    const bName = getSpecifierName(specifierB);

                    return aName > bName ? 1 : -1;
                });


                return fixer.replaceTextRange(
                    [first(specifiers).range[0], last(specifiers).range[1]],
                    sortNodes(specifiers, sorted).trim()
                );
            };
        }


        function fixImportDefinitions(imports) {
            return (fixer) => {
                const sorted = imports.slice().sort((prev, current) => {
                    const prevName = getModuleName(prev);
                    const currentName = getModuleName(current);
                    const isPrevEmpty = isEmptyImport(prev);
                    const isCurrentEmpty = isEmptyImport(current);
                    const isPrevAbsolute = isAbsolute(prevName);
                    const isCurrentAbsolute = isAbsolute(currentName);

                    if (isPrevEmpty && !isCurrentEmpty || isPrevAbsolute && !isCurrentAbsolute) {
                        return -1;
                    }

                    if (!isPrevEmpty && isCurrentEmpty || !isPrevAbsolute && isCurrentAbsolute) {
                        return 1;
                    }

                    if (prevName === currentName) {
                        return 0;
                    }

                    return prevName > currentName ? 1 : -1;
                });

                return fixer.replaceTextRange(
                    [first(imports).range[0], last(imports).range[1]],
                    sortNodes(imports, sorted).trim()
                );
            };
        }


        function isSmallerThanPrevious(name, index, array) {
            if (index === 0) {
                return false;
            }

            const prev = array[index - 1];
            const isModuleAbsolute = isAbsolute(name);
            const isPrevAbsolute = isAbsolute(prev);

            if (isPrevAbsolute && !isModuleAbsolute) {
                return false;
            }

            if (isModuleAbsolute && !isPrevAbsolute) {
                return false;
            }
        }


        function sortNodes(original, sorted) {
            return sorted.reduce((result, node, index) => {
                const oldIndex = original.indexOf(node);
                let before = '';

                // If it wasn't the first import
                if (oldIndex !== 0) {
                    before = getCodeBetween(original[oldIndex - 1], original[oldIndex]);

                // If it was the first import but we're moving it
                } else if (index !== 0) {
                    before = '\n';
                }

                return result + before + source.getText(node);
            }, '');
        }


        function getSpecifierName(specifier) {
            const {name} = specifier.local;

            return caseSensitive ? name : name.toLowerCase();
        }

        function getCodeBetween(nodeA, nodeB) {
            return source.getText().slice(nodeA.range[1], nodeB.range[0]);
        }
    }
};


function getModuleName(node) {
    return node.source.value;
}

function isAbsolute(name) {
    return name[0] !== '.';
}

function isImportDeclaration(node) {
    return node.type === 'ImportDeclaration';
}

function isImportSpecifier(node) {
    return node.type === 'ImportSpecifier';
}

function first(array) {
    return array[0];
}

function last(array) {
    return array[array.length - 1];
}

function isLastIndex(array, index) {
    return index === array.length - 1;
}

function isEmptyImport(node) {
    return node.specifiers.length === 0;
}
