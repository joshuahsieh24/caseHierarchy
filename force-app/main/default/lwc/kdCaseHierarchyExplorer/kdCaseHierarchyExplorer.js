import { LightningElement, api, wire } from 'lwc';
import { CurrentPageReference }        from 'lightning/navigation';
import getCaseHierarchy                from '@salesforce/apex/KD_CaseHierarchyController.getCaseHierarchy';

/* ───────────────────────── Columns ───────────────────────── */
const COLUMNS = [
    {
        label         : 'Case #',
        fieldName     : 'caseUrl',
        type          : 'url',
        typeAttributes: {
            label : { fieldName: 'caseNumber' },
            target: '_self'
        },
        initialWidth  : 120
    },
    { label: 'Subject',     fieldName: 'subject' },
    { label: 'Status',      fieldName: 'status'  },
    { label: 'Child Count', fieldName: 'childCount', type: 'number', initialWidth: 110 }
];

export default class KdCaseHierarchyExplorer extends LightningElement {

    /* ─── public params (with fallback) ─── */
    @api recordId;
    @api objectApiName;

    @wire(CurrentPageReference)
    wiredPageRef(ref) {
        if (ref && ref.attributes) {
            this.recordId      = this.recordId      || ref.attributes.recordId;
            this.objectApiName = this.objectApiName || ref.attributes.objectApiName;
        }
    }

    /* ─── reactive state ─── */
    columns      = COLUMNS;
    expandedRows = [];
    treeData     = { data: undefined, isLoading: true, error: undefined };

    /* ─── Apex wire ─── */
    @wire(getCaseHierarchy,
          { recordId: '$recordId', objectName: '$objectApiName' })
    wiredHierarchy({ data, error }) {
        if (data) {
            const clone = JSON.parse(JSON.stringify(data));
            this.normalise(clone);

            /* auto-expand root nodes */
            this.expandedRows = clone.map(n => n.id);

            this.treeData = { data: clone, isLoading: false };
        } else if (error) {
            this.treeData = { error, isLoading: false };
        }
    }

    /* ──────────────────────────────────────────────────────────
     * normalise()  –  decorate nodes & add dummy children once
       ──────────────────────────────────────────────────────── */
    normalise(nodes) {
        nodes.forEach(n => {

            const isDummy = n.id && String(n.id).endsWith('-dummy');

            /* always a number so grid shows “0” */
            n.childCount = Number(n.childCount || 0);

            /* Case link only for real rows */
            n.caseUrl = isDummy ? '' : '/' + n.id;

            /* add a single dummy child if this is a REAL row with 0 kids */
            if (!isDummy && (!n.children || n.children.length === 0)) {
                n.children = [{
                    id        : `${n.id}-dummy`,
                    caseNumber: '—',
                    subject   : '(No child cases)',
                    status    : '',
                    childCount: 0,
                    children  : []
                }];
            }

            /* expose via _children so <lightning-tree-grid> recurses */
            n._children = n.children || [];

            /* recurse only into real children, not the dummy itself */
            if (!isDummy && n.children && n.children.length) {
                this.normalise(n.children);
            }
        });
    }

    /* remember expand / collapse state */
    handleRowToggle(evt) {
        this.expandedRows = evt.detail.expandedRows;
    }

    /* template helpers */
    get hasError()     { return !!this.treeData.error; }
    get errorMessage() { return this.treeData.error?.body?.message || this.treeData.error?.message; }
}
