/* =========================================================================
 * kdCaseHierarchyExplorer.js
 * -------------------------------------------------------------------------
 *  ▸ Renders a tree-grid for case hierarchies.
 *  ▸ Columns now include Priority & Type.
 *  ▸ Dummy "(No child cases)" node removed.
 * ========================================================================= */
import { LightningElement, api, wire } from 'lwc';
import getHierarchy from '@salesforce/apex/KD_CaseHierarchyController.getHierarchy'; // Updated method reference

/* ----------------------------- Column spec ----------------------------- */
const COLUMNS = [
    { label: 'Case #',   fieldName: 'caseUrl', type: 'url',
      typeAttributes: { label: { fieldName: 'caseNumber' }, target: '_blank' },
      initialWidth: 110 },
    { label: 'Subject',  fieldName: 'subject', wrapText: true },
    { label: 'Status',   fieldName: 'status',  initialWidth: 120 },
    { label: 'Priority', fieldName: 'priority', initialWidth: 100 },   // NEW
    { label: 'Type',     fieldName: 'caseType', initialWidth: 120 },   // NEW
    { label: 'Child Count', fieldName: 'childCount',
      type: 'number', initialWidth: 110 }
];

export default class KdCaseHierarchyExplorer extends LightningElement {

    @api recordId;              // context record

    columns = COLUMNS;          // bound into template
    treeData;                   // wired data holder
    isLoading = true;           // loading state
    hasError = false;           // error state
    errorMessage = '';          // error message
    noCasesFound = false;       // no cases found state
    expandedRows = [];          // expanded rows for tree grid

    /* ------------ Wire Apex → transform → template ------------ */
    @wire(getHierarchy, { contextRecordId: '$recordId' })
    wiredHierarchy({ data, error }) {
        this.isLoading = false;
        
        if (data) {
            const root = JSON.parse(JSON.stringify(data));
            
            // Check if this is a placeholder for no cases
            if (root.id === 'no-cases') {
                this.treeData = null;
                this.hasError = false;
                this.noCasesFound = true;
            } else {
                this.normalise([root]);
                this.treeData = [root];
                this.hasError = false;
                this.noCasesFound = false;
            }
        } else if (error) {
            this.hasError = true;
            this.errorMessage = error.body?.message || 'An error occurred while loading the case hierarchy.';
            // eslint-disable-next-line no-console
            console.error('Case hierarchy error', error);
        }
    }

    /* -----------------------------------------------------------
     * normalise() – decorate nodes & strip dummy rows
     * --------------------------------------------------------- */
    normalise(nodes) {
        nodes.forEach(node => {
            const hasChildren = node.children && node.children.length > 0;

            /* make Case # clickable */
            node.caseUrl = '/' + node.id;

            /* ONLY expose real children to <lightning-tree-grid> */
            node._children = hasChildren ? node.children : [];

            /* recurse */
            if (hasChildren) {
                this.normalise(node.children);
            }
        });
    }

    /* -----------------------------------------------------------
     * handleRowToggle() – handle tree grid row expansion
     * --------------------------------------------------------- */
    handleRowToggle(event) {
        this.expandedRows = event.detail.expandedRows;
    }
}