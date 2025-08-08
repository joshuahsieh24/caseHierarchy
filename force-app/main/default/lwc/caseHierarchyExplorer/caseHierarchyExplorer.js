import { LightningElement, api, wire, track } from 'lwc';
import getHierarchy from '@salesforce/apex/CaseHierarchyController.getHierarchy';

/* ────────────────────────────────────────────────────────────
   Column definitions (names, links, types)
   ──────────────────────────────────────────────────────────── */
const AVAILABLE_COLUMNS = Object.freeze([
    {
        label: 'Case #',
        fieldName: 'caseUrl',
        type: 'url',
        typeAttributes: { label: { fieldName: 'caseNumber' }, target: '_blank' }
    },
    { label: 'Subject',        fieldName: 'subject',       wrapText: true },
    { label: 'Status',         fieldName: 'status'  },
    { label: 'Priority',       fieldName: 'priority' },
    { label: 'Type',           fieldName: 'caseType' },
    { label: 'Child Count',    fieldName: 'childCount', type: 'number' },

    {
        label: 'AE/AM',
        fieldName: 'aeAmUrl',
        type: 'url',
        typeAttributes: { label: { fieldName: 'aeAm' }, target: '_blank' }
    },
    {
        label: 'Work Group',
        fieldName: 'workGroupUrl',
        type: 'url',
        typeAttributes: { label: { fieldName: 'workGroup' }, target: '_blank' }
    },

    { label: 'Origin',         fieldName: 'origin' },
    {
        label: 'Created',
        fieldName: 'createdDate',
        type: 'date',
        typeAttributes: { year: 'numeric', month: 'short', day: '2-digit' }
    },
    {
        label: 'Last Modified',
        fieldName: 'lastModifiedDate',
        type: 'date'
    },
    { label: 'Owner',          fieldName: 'ownerName' }
]);

/* first-time view */
const DEFAULT_FIELD_NAMES = [
    'caseUrl',       // renders Case #
    'subject',
    'status',
    'priority',
    'caseType',
    'childCount',
    'aeAmUrl',
    'workGroupUrl'
];

export default class CaseHierarchyExplorer extends LightningElement {

    /* ───────────── Public API ───────────── */
    @api recordId;

    /* ───────────── Reactive state ───────────── */
    @track columns      = AVAILABLE_COLUMNS.filter(c =>
        DEFAULT_FIELD_NAMES.includes(c.fieldName)
    );
    @track selectedKeys = [...DEFAULT_FIELD_NAMES];
    @track isConfigMode = false;
    @track treeGridKey  = `tg-${Date.now()}`;

    treeData;
    originalData;
    expandedRows = [];
    isLoading    = true;
    noCasesFound = false;
    hasError     = false;
    errorMessage = '';

    /* ───────────── Apex wire ───────────── */
    @wire(getHierarchy, { contextRecordId: '$recordId' })
    wiredHierarchy({ data, error }) {
        this.isLoading = false;
        if (data) {
            this.originalData = JSON.parse(JSON.stringify(data));
            this._refreshTreeData();
            this.noCasesFound = this.originalData.id === 'no-cases';
        } else if (error) {
            this.hasError    = true;
            this.errorMessage = error.body?.message || JSON.stringify(error);
            // eslint-disable-next-line no-console
            console.error('[CaseHierarchy] Apex error', error);
        }
    }

    /* ───────────── Column configurator ───────────── */
    get columnOptions() {
        return AVAILABLE_COLUMNS.map(c => ({ label: c.label, value: c.fieldName }));
    }
    handleToggleConfig() {
        this.isConfigMode = true;
        this.selectedKeys = [...this.columns.map(c => c.fieldName)];
    }
    handleColumnPick(evt) {
        this.selectedKeys = evt.detail.value;
    }
    handleSave() {
        this.columns = AVAILABLE_COLUMNS.filter(c =>
            this.selectedKeys.includes(c.fieldName)
        );
        this.treeGridKey = `tg-${Date.now()}`;   // force re-render
        this._refreshTreeData();
        this.isConfigMode = false;
    }
    handleCancel() {
        this.isConfigMode = false;
    }

    /* ───────────── Tree helpers ───────────── */
    _refreshTreeData() {
        if (!this.originalData) return;
        const root = JSON.parse(JSON.stringify(this.originalData));
        this._normalise([root]);
        this.treeData     = [root];
        this.expandedRows = this._collectAllNodeIds([root]);
    }

    /**
     * Recursively collect all node IDs to expand the entire hierarchy
     */
    _collectAllNodeIds(nodes) {
        const allIds = [];
        nodes.forEach(node => {
            allIds.push(node.id);
            if (node._children && node._children.length > 0) {
                allIds.push(...this._collectAllNodeIds(node._children));
            }
        });
        return allIds;
    }

    /**
     * Normalise nodes so lightning-tree-grid is happy.
     * - Build URLs only for real Salesforce Ids (15/18 chars)
     * - Provide safe defaults so the grid never crashes
     */
    _normalise(nodes) {
        nodes.forEach(n => {
            const isRealId = typeof n.id === 'string' &&
                             (n.id.length === 15 || n.id.length === 18);

            n.caseUrl       = isRealId ? `/${n.id}`       : '';
            n.aeAmUrl       = n.aeAmId      ? `/${n.aeAmId}`      : '';
            n.workGroupUrl  = n.workGroupId ? `/${n.workGroupId}` : '';

            /* For synthetic root rows, surface their label */
            if (!isRealId && n.label && !n.caseNumber) {
                n.caseNumber = n.label;
            }

            const defs = {
                caseNumber : n.caseNumber || '—',
                subject    : n.subject    || '—',
                status     : n.status     || '—',
                priority   : n.priority   || '—',
                caseType   : n.caseType   || '—',
                ownerName  : n.ownerName  || '—',
                origin     : n.origin     || '—',
                childCount : n.childCount ?? 0,
                aeAm       : n.aeAm       || '—',
                workGroup  : n.workGroup  || '—'
            };
            Object.entries(defs).forEach(([k, v]) => {
                if (n[k] === undefined || n[k] === null) n[k] = v;
            });

            /* ISO dates for grid formatting */
            ['createdDate', 'lastModifiedDate'].forEach(d => {
                if (n[d]) {
                    try { n[d] = new Date(n[d]).toISOString(); } catch (_) {}
                }
            });

            /* recurse children */
            n._children = n.children?.length ? n.children : [];
            if (n._children.length) this._normalise(n._children);
        });
    }

    handleRowToggle(evt) {
        this.expandedRows = evt.detail.expandedRows;
    }
}
