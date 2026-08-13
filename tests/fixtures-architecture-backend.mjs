export const architectureBackendFixture = {
  'architecture/back/Demo.API/Controllers/AccountsCommandController.cs': `using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace Demo.API.Controllers;

[Route("api/accounts")]
public class AccountsCommandController : ControllerBase
{
    private readonly IMediator _mediator;

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateAccountCommand command)
    {
        // var ghost = await _mediator.Send(new GhostCommand());
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Archive(string id)
    {
        var result = await _mediator.Send(new ArchiveAccountCommand(id));
        return Ok(result);
    }
}
`,
  'architecture/back/Demo.Application/Accounts/Commands/ArchiveAccountCommand.cs': `namespace Demo.Application.Accounts.Commands;

public record ArchiveAccountCommand(string Id) : ICommand;
`,
  'architecture/back/Demo.Application/Accounts/Commands/GhostCommand.cs': `namespace Demo.Application.Accounts.Commands;

public record GhostCommand() : ICommand;
`,
  'architecture/back/Demo.API/Controllers/AccountsController.cs': `using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Demo.API.Controllers;

public class AccountsController : ControllerBase
{
    private readonly DbContext _dbContext;

    public async Task<IActionResult> Save()
    {
        await _dbContext.SaveChangesAsync();
        return Ok();
    }
}
`,
  'architecture/back/Demo.Application/Accounts/Commands/CreateAccountCommand.cs': `namespace Demo.Application.Accounts.Commands;

public record CreateAccountCommand(string Name) : ICommand;
`,
  'architecture/back/Demo.Application/Accounts/Commands/NotifyAccountCommand.cs': `namespace Demo.Application.Accounts.Commands;

public record NotifyAccountCommand(string AccountId) : ICommand;
`,
  'architecture/back/Demo.Application/Accounts/Handlers/AccountStatusReporter.cs': `using MediatR;

namespace Demo.Application.Accounts.Handlers;

public class AccountStatusReporter
{
    private readonly IMediator _mediator;

    public async Task Report(string accountId, CancellationToken cancellationToken)
    {
        await _mediator.Send(new GetStatusQuery(accountId), cancellationToken);
    }
}
`,
  'architecture/back/Demo.Application/Accounts/Handlers/CreateAccountCommandHandler.cs': `using MediatR;

namespace Demo.Application.Accounts.Handlers;

public class CreateAccountCommandHandler
{
    private readonly IMediator _mediator;
    private readonly IAccountRepository _repository;

    public CreateAccountCommandHandler(IMediator mediator, IAccountRepository repository)
    {
        _mediator = mediator;
        _repository = repository;
    }

    public async Task Handle(CreateAccountCommand request, CancellationToken cancellationToken)
    {
        await _mediator.Send(new NotifyAccountCommand(request.Name), cancellationToken);
    }
}
`,
  'architecture/back/Demo.Infrastructure/Repositories/Interfaces/IAccountRepository.cs': `namespace Demo.Infrastructure.Repositories.Interfaces;

public interface IAccountRepository
{
}
`,
  'architecture/back/Demo.Infrastructure/Repositories/AccountRepository.cs': `namespace Demo.Infrastructure.Repositories;

public class AccountRepository : IAccountRepository
{
}
`,
  'architecture/back/Demo.Application/Accounts/Queries/GetStatusQuery.cs': `namespace Demo.Application.Accounts.Queries;

public record GetStatusQuery(string AccountId);
`,
  'architecture/back/Demo.Application/Common/Commands/ICommand.cs': `namespace Demo.Application.Common.Commands;

public interface ICommand
{
}
`,
  'architecture/back/Demo.Application/Reporting/Handlers/ReportStatusReader.cs': `using MediatR;

namespace Demo.Application.Reporting.Handlers;

public class ReportStatusReader
{
    private readonly IMediator _mediator;

    public async Task Read(string reportId, CancellationToken cancellationToken)
    {
        await _mediator.Send(new GetStatusQuery(reportId), cancellationToken);
    }
}
`,
  'architecture/back/Demo.Application/Reporting/Queries/GetStatusQuery.cs': `namespace Demo.Application.Reporting.Queries;

public record GetStatusQuery(string ReportId);
`,
  'architecture/back/Demo.Domain/Entities/Account.cs': `using Demo.API.Controllers;

namespace Demo.Domain.Entities;

public class Account
{
    public string Name { get; set; } = "";
}
`
}
