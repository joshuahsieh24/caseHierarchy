import { LightningElement, api, wire, track } from 'lwc';
import getHierarchy from '@salesforce/apex/KD_CaseHierarchyController.getHierarchy';

const BASE_COLUMNS = [
    { label: 'Case #', fieldName: 'caseUrl', type: 'url',
      typeAttributes: { label: { fieldName: 'caseNumber' }, target: '_blank' } },
    { label: 'Subject', fieldName: 'subject', wrapText: true },
    { label: 'Status', fieldName: 'status' },
    { label: 'Priority', fieldName: 'priority' },
    { label: 'Type', fieldName: 'caseType' },
    { label: 'Child Count', fieldName: 'childCount', type: 'number' }
];

export default class KdCaseHierarchyExplorer extends LightningElement {
    @api recordId;

    @track columns = [...BASE_COLUMNS];
    @track isConfigMode = false;
    @track draftColumns = [];
    @track draftValues = [];

    treeData;
    expandedRows = [];
    isLoading = true;
    noCasesFound = false;
    hasError = false;
    errorMessage = '';

    @wire(getHierarchy, { contextRecordId: '$recordId' })
    wiredHierarchy({ data, error }) {
        this.isLoading = false;
        if (data) {
            const root = JSON.parse(JSON.stringify(data));
            this._normalise([root]);
            this.treeData = [root];
            this.expandedRows = [root.id];
            this.noCasesFound = root.childCount === 0;
        } else if (error) {
            this.hasError = true;
            this.errorMessage = error.body?.message || JSON.stringify(error);
        }
    }

    _normalise(nodes) {
        nodes.forEach(n => {
            n.caseUrl = '/' + n.id;
            n._children = (n.children && n.children.length) ? n.children : [];
            if (n._children.length) this._normalise(n._children);
        });
    }

    get availableApiNames() {
        return [
            { label: 'Case Number', value: 'caseNumber' },
            { label: 'Subject', value: 'subject' },
            { label: 'Status', value: 'status' },
            { label: 'Priority', value: 'priority' },
            { label: 'Type', value: 'caseType' },
            { label: 'Owner', value: 'ownerName' },
            { label: 'Account', value: 'accountName' },
            { label: 'Contact', value: 'contactName' },
            { label: 'Created Date', value: 'createdDate' },
            { label: 'Last Modified', value: 'lastModifiedDate' },
            { label: 'Closed Date', value: 'closedDate' },
            { label: 'Escalated?', value: 'isEscalated' },
            { label: 'Closed?', value: 'isClosed' },
            { label: 'Child Count', value: 'childCount' }
        ];
    }

    get configColumns() {
        return [
            { label: 'Label', fieldName: 'label', type: 'text', editable: true },
            {
                label: 'API Name',
                fieldName: 'fieldName',
                type: 'picklist',
                editable: true,
                typeAttributes: {
                    options: this.availableApiNames,
                    placeholder: 'Select API Name',
                    value: { fieldName: 'fieldName' },
                    context: { fieldName: '_id' }
                }
            },
            {
                label: ' ',
                type: 'button-icon',
                initialWidth: 50,
                typeAttributes: {
                    iconName: 'utility:close',
                    alternativeText: 'Remove',
                    name: 'remove',
                    title: 'Remove',
                    variant: 'bare'
                }
            }
        ];
    }

    handleToggleConfig() {
        this.isConfigMode = true;
        this.draftColumns = this.columns.map((c, i) => ({ ...c, _id: i }));
        this.draftValues = [];
    }

    handleAdd() {
        this.draftColumns = [
            ...this.draftColumns,
            { _id: Date.now(), label: 'New column', fieldName: 'caseNumber' }
        ];
    }

    handleRowAction(evt) {
        if (evt.detail.action.name === 'remove') {
            const rowId = evt.detail.row._id;
            this.draftColumns = this.draftColumns.filter(c => c._id !== rowId);
        }
    }

    handleCellChange(evt) {
        this.draftValues = evt.detail.draftValues;
    }

    handleSave() {
        this.draftValues.forEach(dv => {
            const idx = this.draftColumns.findIndex(c => c._id === dv._id);
            if (idx !== -1) {
                this.draftColumns[idx] = { ...this.draftColumns[idx], ...dv };
            }
        });

        this.columns = this.draftColumns.map(({ label, fieldName }) =>
            this._buildColumn(label, fieldName)
        );

        this.isConfigMode = false;
        this.draftColumns = [];
        this.draftValues = [];
    }

    handleCancel() {
        this.isConfigMode = false;
        this.draftColumns = [];
        this.draftValues = [];
    }

    _buildColumn(label, fieldName) {
        const base = { label, fieldName, initialWidth: 120,
                       minColumnWidth: 80, maxColumnWidth: 400 };

        switch (fieldName) {
            case 'caseUrl':
                return { ...base, type: 'url',
                         typeAttributes: { label: { fieldName: 'caseNumber' }, target: '_blank' } };
            case 'subject':
                return { ...base, wrapText: true, initialWidth: 300 };
            case 'childCount':
                return { ...base, type: 'number', initialWidth: 100 };
            case 'createdDate':
            case 'lastModifiedDate':
            case 'closedDate':
                return { ...base, type: 'date', initialWidth: 140 };
            case 'isEscalated':
            case 'isClosed':
                return { ...base, type: 'boolean', initialWidth: 110 };
            default:
                return base;
        }
    }

    handleRowToggle(e) {
        this.expandedRows = e.detail.expandedRows;
    }
}
